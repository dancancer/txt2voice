FROM index-tts-index-tts-fastapi:latest

ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /srv

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
  && rm -rf /var/lib/apt/lists/*

RUN uv pip install --python /app/.venv/bin/python \
      --index-url https://mirrors.aliyun.com/pypi/simple/ \
      --trusted-host mirrors.aliyun.com \
      "datasets==2.18.0" \
      voxcpm fastapi uvicorn python-multipart soundfile

COPY app.py /srv/app.py

CMD ["/app/.venv/bin/python", "/srv/app.py"]
