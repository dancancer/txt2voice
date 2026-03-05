FROM index-tts-index-tts-fastapi:latest

ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /srv

RUN apt-get update \
  && apt-get install -y --no-install-recommends git git-lfs ffmpeg sox libsndfile1 \
  && rm -rf /var/lib/apt/lists/*

RUN git lfs install \
  && git clone --depth 1 --recurse-submodules --shallow-submodules https://github.com/FunAudioLLM/CosyVoice.git /opt/CosyVoice

RUN awk '!/^(--extra-index-url)/ \
      && !/^tensorrt-cu12/ \
      && !/^deepspeed==/ \
      && !/^torch==/ \
      && !/^torchaudio==/ \
      && !/^onnxruntime-gpu==/ \
      && !/^onnxruntime==/ \
      && !/^onnx==/ \
      && !/^openai-whisper==/' /opt/CosyVoice/requirements.txt > /tmp/requirements.infer.txt \
  && uv pip install --python /app/.venv/bin/python \
      --index-url https://mirrors.aliyun.com/pypi/simple/ \
      --trusted-host mirrors.aliyun.com \
      -r /tmp/requirements.infer.txt \
  && uv pip install --python /app/.venv/bin/python \
      --index-url https://mirrors.aliyun.com/pypi/simple/ \
      --trusted-host mirrors.aliyun.com \
      fastapi uvicorn python-multipart soundfile onnx onnxruntime tiktoken \
  && /app/.venv/bin/python -m ensurepip \
  && /app/.venv/bin/python -m pip install --no-build-isolation --no-deps \
      -i https://mirrors.aliyun.com/pypi/simple/ \
      --trusted-host mirrors.aliyun.com \
      --no-cache-dir openai-whisper==20231117

COPY app.py /srv/app.py

ENV PYTHONPATH=/opt/CosyVoice:/opt/CosyVoice/third_party/Matcha-TTS

CMD ["/app/.venv/bin/python", "/srv/app.py"]
