# Character Recognition Service

中文小说人物识别与结构化抽取系统 - 基于 NER + 规则 + 语义聚类。

## 功能特性

- **人名识别**: 基于 HanLP NER 模型 + 规则模板
- **别名合并**: 使用句向量相似度聚类
- **指代消解**: 启发式规则解析代词指向
- **对话归因**: 自动识别台词说话者
- **结构化输出**: JSON 格式的人物信息和关系图
- **API 服务**: FastAPI 提供 RESTful API 接口

## 系统架构

```
输入小说文本
     ↓
文本预处理（清洗、分句）
     ↓
人名识别（NER + 规则）
     ↓
称呼与别名挖掘（规则/模板）
     ↓
核心名归一化（前后缀/儿化）
     ↓
别名聚类与合并（规则 + 向量相似）
     ↓
指代消解（启发式）
     ↓
对话归因（说话者识别）
     ↓
人物结构化输出 + 关系图
```

## 技术栈

- **框架**: FastAPI（Python Web 框架）
- **NER**: HanLP 2.x（中文 NER 预训练模型）
- **句向量**: SimCSE/Text2Vec（中文句向量模型）
- **向量检索**: FAISS（快速近邻搜索）
- **Python**: 3.9+

## 安装依赖

```bash
# 在项目根目录
cd apps/character-recognition

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

## 本地开发

```bash
# 启动开发服务器
python main.py

# 或使用 uvicorn
uvicorn main:app --reload --port 8001
```

服务将在 http://localhost:8001 启动。

## API 使用

### 识别人物

```bash
POST /api/recognize
Content-Type: application/json

{
  "text": "小说文本内容",
  "options": {
    "enable_coreference": true,
    "enable_dialogue": true,
    "similarity_threshold": 0.8
  }
}
```

响应：

```json
{
  "characters": [
    {
      "id": "c001",
      "name": "雅芙",
      "aliases": ["大小姐"],
      "mentions": 12,
      "first_appearance_idx": 121,
      "gender": "女",
      "roles": ["老板的女儿"],
      "quotes": 7
    }
  ],
  "alias_map": { "大小姐": "雅芙" },
  "relations": [
    { "from": "王强", "to": "雅芙", "type": "对话", "weight": 7 }
  ],
  "statistics": {
    "total_characters": 5,
    "total_mentions": 50,
    "total_dialogues": 20,
    "processing_time": 1.23
  }
}
```

### 健康检查

```bash
GET /health
```

## Docker 部署

```bash
# 构建镜像
docker build -t character-recognition .

# 运行容器
docker run -p 8001:8001 character-recognition
```

## 配置

配置文件位于 `src/config.py`，可调整：

- **NER 模型**: HanLP 模型路径和参数
- **向量模型**: 句向量模型路径
- **相似度阈值**: 别名合并阈值 (默认 0.8)
- **规则模板**: 称呼前后缀、触发词等

## 项目结构

```
apps/character-recognition/
├── src/
│   ├── models/              # 数据模型
│   ├── core/                # 核心模块
│   │   ├── preprocessor.py  # 文本预处理
│   │   ├── ner.py          # NER 识别
│   │   ├── alias.py        # 别名识别与合并
│   │   ├── coreference.py  # 指代消解
│   │   └── dialogue.py     # 对话归因
│   ├── recognizer.py       # 主识别器
│   ├── config.py           # 配置
│   └── utils.py            # 工具函数
├── tests/                  # 测试文件
├── main.py                 # FastAPI 入口
├── requirements.txt        # Python 依赖
├── Dockerfile             # Docker 配置
└── README.md              # 本文档
```

## 开发进度

- [x] P0: 项目结构搭建
- [ ] P0: 文本预处理 + NER + 别名规则
- [ ] P1: 核心名归一化 + 别名聚合
- [ ] P2: 对话归因 + 指代消解
- [ ] P3: 人物关系图
- [ ] P4: 人物画像（性格/情绪/立场）

## 集成到主应用

该服务可以被 `apps/web` 应用调用：

```typescript
// apps/web/src/lib/character-api.ts
const response = await fetch('http://localhost:8001/api/recognize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: novelText })
});
const result = await response.json();
```

## License

ISC
