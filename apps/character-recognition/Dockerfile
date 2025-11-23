# 使用 Python 3.9 基础镜像
FROM python:3.9-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY apps/character-recognition/requirements.txt .

# 安装 Python 依赖（使用清华镜像加速）
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple && \
    pip install --no-cache-dir -r requirements.txt

# 下载模型（可选，首次运行时自动下载）
# RUN python -c "import hanlp; hanlp.load('hanlp.pretrained.ner.MSRA_NER_BERT_BASE_ZH')"

# 复制应用代码
COPY apps/character-recognition/ .

# 创建日志目录
RUN mkdir -p logs

# 暴露端口
EXPOSE 8001

# 设置环境变量
ENV PYTHONUNBUFFERED=1
ENV HOST=0.0.0.0
ENV PORT=8001
ENV HANLP_URL=https://ftp.hankcs.com/hanlp/
ENV HANLP_VERBOSE=1

# 入口脚本（按架构开启 Apple Silicon 数学加速）
RUN chmod +x entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]

# 启动命令
CMD ["python", "main.py"]
