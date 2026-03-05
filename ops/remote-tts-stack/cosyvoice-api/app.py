import os
import uuid
import threading
import shutil
from datetime import datetime
from pathlib import Path
from typing import Literal

import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from cosyvoice.cli.cosyvoice import AutoModel


SERVICE_DATA_ROOT = Path(os.getenv("SERVICE_DATA_ROOT", "/data"))
UPLOAD_DIR = SERVICE_DATA_ROOT / "uploads"
OUTPUT_DIR = SERVICE_DATA_ROOT / "outputs"
EXAMPLE_CACHE_DIR = SERVICE_DATA_ROOT / "examples"
MODEL_DIR = os.getenv("COSYVOICE_MODEL_DIR", "iic/CosyVoice2-0.5B")
PORT = int(os.getenv("PORT", "8000"))
IS_COSYVOICE3 = "CosyVoice3" in MODEL_DIR
EOP_TOKEN = "<|endofprompt|>"
DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant."

EXAMPLE_DIRS = [
    Path("/opt/CosyVoice/asset"),
    Path("/opt/CosyVoice/examples"),
]
ALLOWED_EXTS = {".wav", ".mp3", ".flac", ".m4a", ".ogg"}


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    mode: Literal["zero_shot", "cross_lingual", "sft", "instruct2"] = "zero_shot"
    reference_audio: str | None = None
    prompt_text: str | None = ""
    speaker_id: str | None = None
    instruct_text: str | None = None
    stream: bool = False


app = FastAPI(title="CosyVoice FastAPI", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_model = None
_model_lock = threading.Lock()


def ensure_dirs() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    EXAMPLE_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def sync_examples() -> None:
    for source_dir in EXAMPLE_DIRS:
        if not source_dir.exists():
            continue

        for entry in source_dir.iterdir():
            if not entry.is_file() or entry.suffix.lower() not in ALLOWED_EXTS:
                continue
            target = EXAMPLE_CACHE_DIR / entry.name
            if target.exists():
                continue
            shutil.copy2(entry, target)



def get_model() -> AutoModel:
    global _model
    if _model is not None:
        return _model

    with _model_lock:
        if _model is None:
            _model = AutoModel(model_dir=MODEL_DIR)
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

    candidates = [UPLOAD_DIR / filename, EXAMPLE_CACHE_DIR / filename]

    for path in candidates:
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



def make_cosyvoice3_text(text: str) -> str:
    clean = text.strip()
    if EOP_TOKEN in clean:
        return clean
    return f"{DEFAULT_SYSTEM_PROMPT}{EOP_TOKEN}{clean}"


def make_cosyvoice3_prompt(prompt_text: str) -> str:
    clean = prompt_text.strip()
    if EOP_TOKEN in clean:
        return clean
    if not clean:
        return f"{DEFAULT_SYSTEM_PROMPT}{EOP_TOKEN}"
    return f"{DEFAULT_SYSTEM_PROMPT}{EOP_TOKEN}{clean}"


def make_cosyvoice3_instruct(instruct_text: str) -> str:
    clean = instruct_text.strip()
    if EOP_TOKEN in clean:
        return clean
    if not clean.startswith(DEFAULT_SYSTEM_PROMPT):
        clean = f"{DEFAULT_SYSTEM_PROMPT} {clean}".strip()
    return f"{clean}{EOP_TOKEN}"


def synthesize(req: SynthesizeRequest) -> tuple[np.ndarray, int]:
    cosyvoice = get_model()
    tts_text = req.text

    if req.mode == "sft":
        if not req.speaker_id:
            raise HTTPException(status_code=400, detail="sft 模式要求 speaker_id")
        if IS_COSYVOICE3:
            tts_text = make_cosyvoice3_text(tts_text)
        outputs = cosyvoice.inference_sft(tts_text, req.speaker_id, stream=req.stream)
    elif req.mode == "zero_shot":
        prompt_path = resolve_audio_path(req.reference_audio)
        prompt_text = req.prompt_text or ""
        if IS_COSYVOICE3:
            prompt_text = make_cosyvoice3_prompt(prompt_text)
        outputs = cosyvoice.inference_zero_shot(
            tts_text,
            prompt_text,
            prompt_path.as_posix(),
            stream=req.stream,
        )
    elif req.mode == "cross_lingual":
        prompt_path = resolve_audio_path(req.reference_audio)
        if IS_COSYVOICE3:
            tts_text = make_cosyvoice3_text(tts_text)
        outputs = cosyvoice.inference_cross_lingual(
            tts_text,
            prompt_path.as_posix(),
            stream=req.stream,
        )
    else:
        if not req.instruct_text:
            raise HTTPException(status_code=400, detail="instruct2 模式要求 instruct_text")
        prompt_path = resolve_audio_path(req.reference_audio)
        instruct_text = req.instruct_text
        if IS_COSYVOICE3:
            instruct_text = make_cosyvoice3_instruct(instruct_text)
        outputs = cosyvoice.inference_instruct2(
            tts_text,
            instruct_text,
            prompt_path.as_posix(),
            stream=req.stream,
        )

    chunks: list[np.ndarray] = []
    for item in outputs:
        speech = item["tts_speech"]
        if hasattr(speech, "detach"):
            speech = speech.detach().cpu().numpy()
        chunks.append(np.asarray(speech).reshape(-1).astype(np.float32))

    if not chunks:
        raise HTTPException(status_code=500, detail="模型未返回音频数据")

    sample_rate = int(getattr(cosyvoice, "sample_rate", 22050))
    return np.concatenate(chunks), sample_rate


@app.on_event("startup")
def startup_event() -> None:
    ensure_dirs()
    sync_examples()


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "model": MODEL_DIR,
        "modelLoaded": _model is not None,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


@app.get("/api/audio/list")
def audio_list() -> dict:
    items = list_audio_files(UPLOAD_DIR, "uploaded")
    items.extend(list_audio_files(EXAMPLE_CACHE_DIR, "example"))
    return {"success": True, "data": items}


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


@app.get("/api/speakers")
def speakers() -> dict:
    cosyvoice = get_model()
    if not hasattr(cosyvoice, "list_available_spks"):
        return {"success": True, "data": []}
    data = cosyvoice.list_available_spks() or []
    return {"success": True, "data": data}


@app.post("/api/tts/synthesize")
def tts_synthesize(req: SynthesizeRequest) -> dict:
    speech, sample_rate = synthesize(req)

    filename = f"cosy_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.wav"
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
            "mode": req.mode,
            "model": MODEL_DIR,
        },
    }


app.mount("/files", StaticFiles(directory=SERVICE_DATA_ROOT.as_posix()), name="files")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=PORT)
