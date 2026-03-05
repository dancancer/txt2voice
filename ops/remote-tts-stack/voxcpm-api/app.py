import os
import uuid
import threading
from datetime import datetime
from pathlib import Path

import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from modelscope import snapshot_download
from pydantic import BaseModel, Field
from voxcpm import VoxCPM
from voxcpm.model.voxcpm import VoxCPMModel


SERVICE_DATA_ROOT = Path(os.getenv("SERVICE_DATA_ROOT", "/data"))
UPLOAD_DIR = SERVICE_DATA_ROOT / "uploads"
OUTPUT_DIR = SERVICE_DATA_ROOT / "outputs"
MODEL_ROOT = Path(os.getenv("VOXCPM_MODEL_ROOT", "/models"))
MODEL_ID = os.getenv("VOXCPM_MODEL_ID", "OpenBMB/VoxCPM-0.5B")
DISABLE_TORCH_COMPILE = os.getenv("VOXCPM_DISABLE_TORCH_COMPILE", "1") == "1"
PORT = int(os.getenv("PORT", "8000"))

ALLOWED_EXTS = {".wav", ".mp3", ".flac", ".m4a", ".ogg"}


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    reference_audio: str | None = None
    prompt_text: str | None = None
    stream: bool = False
    cfg_value: float = 2.0
    inference_timesteps: int = 10
    normalize: bool = False
    denoise: bool = False
    retry_badcase: bool = True
    retry_badcase_max_times: int = 3
    retry_badcase_ratio_threshold: float = 6.0


app = FastAPI(title="VoxCPM FastAPI", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_model = None
_model_lock = threading.Lock()
_compile_patched = False


def ensure_dirs() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_ROOT.mkdir(parents=True, exist_ok=True)



def local_model_dir() -> Path:
    safe_name = MODEL_ID.replace("/", "__")
    return MODEL_ROOT / safe_name



def disable_model_compile_if_needed() -> None:
    global _compile_patched
    if _compile_patched or not DISABLE_TORCH_COMPILE:
        return

    def _disable_optimize(self):
        self.base_lm.forward_step = self.base_lm.forward_step
        self.residual_lm.forward_step = self.residual_lm.forward_step
        self.feat_encoder_step = self.feat_encoder
        self.feat_decoder.estimator = self.feat_decoder.estimator
        return self

    VoxCPMModel.optimize = _disable_optimize
    _compile_patched = True



def get_model() -> VoxCPM:
    global _model
    if _model is not None:
        return _model

    with _model_lock:
        if _model is None:
            disable_model_compile_if_needed()
            model_dir = local_model_dir()
            if not model_dir.exists() or not any(model_dir.iterdir()):
                snapshot_download(MODEL_ID, local_dir=model_dir.as_posix())
            _model = VoxCPM.from_pretrained(model_dir.as_posix())
    return _model



def file_url(path: Path) -> str:
    relative = path.relative_to(SERVICE_DATA_ROOT)
    return f"/files/{relative.as_posix()}"



def list_audio_files(base: Path, audio_type: str) -> list[dict]:
    if not base.exists():
        return []

    items: list[dict] = []
    for entry in sorted(base.iterdir()):
        if not entry.is_file() or entry.suffix.lower() not in ALLOWED_EXTS:
            continue
        items.append(
            {
                "filename": entry.name,
                "audioType": audio_type,
                "fileSize": entry.stat().st_size,
                "path": str(entry),
                "url": file_url(entry),
            }
        )
    return items



def resolve_audio_path(filename: str | None) -> Path:
    if not filename:
        raise HTTPException(status_code=400, detail="reference_audio 不能为空")

    if "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="reference_audio 文件名非法")

    path = UPLOAD_DIR / filename
    if path.exists() and path.is_file():
        return path

    raise HTTPException(status_code=404, detail=f"未找到参考音频: {filename}")


def resolve_upload_audio_path(filename: str) -> Path:
    if not filename:
        raise HTTPException(status_code=400, detail="filename 不能为空")

    if "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="filename 非法")

    path = UPLOAD_DIR / filename
    if path.exists() and path.is_file():
        return path

    raise HTTPException(status_code=404, detail=f"未找到可删除的上传音频: {filename}")



def synthesize(req: SynthesizeRequest) -> tuple[np.ndarray, int]:
    model = get_model()
    kwargs = {
        "text": req.text,
        "cfg_value": req.cfg_value,
        "inference_timesteps": req.inference_timesteps,
        "normalize": req.normalize,
        "denoise": req.denoise,
        "retry_badcase": req.retry_badcase,
        "retry_badcase_max_times": req.retry_badcase_max_times,
        "retry_badcase_ratio_threshold": req.retry_badcase_ratio_threshold,
    }

    if req.reference_audio:
        kwargs["prompt_wav_path"] = resolve_audio_path(req.reference_audio).as_posix()
    else:
        kwargs["prompt_wav_path"] = None

    kwargs["prompt_text"] = req.prompt_text

    if req.stream:
        chunks = [chunk for chunk in model.generate_streaming(**kwargs)]
        if not chunks:
            raise HTTPException(status_code=500, detail="模型未返回音频数据")
        wav = np.concatenate(chunks)
    else:
        wav = model.generate(**kwargs)

    return np.asarray(wav).reshape(-1).astype(np.float32), int(model.tts_model.sample_rate)


@app.on_event("startup")
def startup_event() -> None:
    ensure_dirs()


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "model": MODEL_ID,
        "modelLoaded": _model is not None,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


@app.get("/api/audio/list")
def audio_list() -> dict:
    return {"success": True, "data": list_audio_files(UPLOAD_DIR, "uploaded")}


@app.post("/api/audio/upload")
async def audio_upload(file: UploadFile = File(...)) -> dict:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {ext}")

    filename = f"upload_{uuid.uuid4().hex[:10]}{ext}"
    save_path = UPLOAD_DIR / filename
    content = await file.read()
    save_path.write_bytes(content)

    return {
        "success": True,
        "data": {
            "filename": filename,
            "originalName": file.filename,
            "fileSize": len(content),
            "url": file_url(save_path),
            "audioType": "uploaded",
        },
    }


@app.delete("/api/audio/{filename}")
def audio_delete(filename: str) -> dict:
    target = resolve_upload_audio_path(filename)

    try:
        target.unlink()
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"删除音频失败: {exc}") from exc

    return {
        "success": True,
        "data": {
            "filename": filename,
            "deleted": True,
        },
    }


@app.post("/api/tts/synthesize")
def tts_synthesize(req: SynthesizeRequest) -> dict:
    speech, sample_rate = synthesize(req)

    filename = f"voxcpm_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.wav"
    output_path = OUTPUT_DIR / filename
    sf.write(output_path.as_posix(), speech, sample_rate)

    duration = float(len(speech) / sample_rate) if sample_rate > 0 else 0.0
    return {
        "success": True,
        "data": {
            "filename": filename,
            "audioUrl": file_url(output_path),
            "duration": duration,
            "sampleRate": sample_rate,
            "model": MODEL_ID,
        },
    }


app.mount("/files", StaticFiles(directory=SERVICE_DATA_ROOT.as_posix()), name="files")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=PORT)
