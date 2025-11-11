# 快速开始

## 5 分钟快速体验

### 1. 安装依赖

```bash
cd apps/character-recognition

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 运行示例

```bash
# 运行内置示例
python example.py
```

你将看到类似这样的输出：

```
==================================================
中文小说人物识别系统 - 示例
==================================================

正在初始化识别器...
正在识别人物...

==================================================
识别结果
==================================================

共识别出 5 个人物：

1. 雅芙
   - 别名: 大小姐, 雅芙小姐
   - 性别: 女
   - 提及次数: 8
   - 台词数: 3
   - 首次出现: 第 10 字符

2. 王强
   - 别名: 王先生, 王少爷
   - 性别: 男
   - 提及次数: 7
   - 台词数: 2
   - 首次出现: 第 85 字符

...
```

### 3. 启动 API 服务

```bash
# 启动服务
python main.py

# 或使用 uvicorn（开发模式）
uvicorn main:app --reload --port 8001
```

服务启动后访问：http://localhost:8001/docs

### 4. 测试 API

使用 curl 测试：

```bash
curl -X POST "http://localhost:8001/api/recognize" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "张三是一个好人。李四和张三是朋友。他们经常一起出去玩。",
    "options": {
      "enable_coreference": true,
      "enable_dialogue": true,
      "similarity_threshold": 0.8
    }
  }'
```

或使用 Python：

```python
import requests

response = requests.post(
    "http://localhost:8001/api/recognize",
    json={
        "text": "你的小说文本...",
        "options": {
            "enable_coreference": True,
            "enable_dialogue": True
        }
    }
)

result = response.json()
print(f"识别到 {len(result['characters'])} 个人物")
```

## 使用自己的文本

### 创建测试脚本

创建 `my_test.py`:

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.models import RecognitionRequest, RecognitionOptions
from src.recognizer import CharacterRecognizer

# 读取你的小说文本
with open("your_novel.txt", "r", encoding="utf-8") as f:
    novel_text = f.read()

# 创建识别器
recognizer = CharacterRecognizer()

# 创建请求
request = RecognitionRequest(
    text=novel_text,
    options=RecognitionOptions(
        enable_coreference=True,
        enable_dialogue=True,
        enable_relations=True,
        max_characters=20  # 只返回前20个人物
    )
)

# 执行识别
result = recognizer.recognize(request)

# 输出结果
for char in result.characters:
    print(f"{char.name}: 提及{char.mentions}次, 台词{char.quotes}条")
```

### 运行测试

```bash
python my_test.py
```

## 与 Web 应用集成

### 1. 启动所有服务

```bash
# 在项目根目录
docker-compose up -d
```

### 2. 在 Next.js 中调用

创建 `apps/web/src/lib/character-api.ts`（参考 INTEGRATION.md）

### 3. 创建页面

```typescript
// apps/web/src/app/books/[id]/characters/page.tsx
'use client';

import { useState } from 'react';
import { recognizeCharacters } from '@/lib/character-api';

export default function CharactersPage() {
  const [text, setText] = useState('');
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleRecognize = async () => {
    setLoading(true);
    try {
      const result = await recognizeCharacters(text);
      setCharacters(result.characters);
    } catch (error) {
      console.error('Recognition failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h1>人物识别</h1>
      
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="粘贴小说文本..."
        className="w-full h-64 border p-2"
      />
      
      <button
        onClick={handleRecognize}
        disabled={loading}
        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
      >
        {loading ? '识别中...' : '开始识别'}
      </button>

      <div className="mt-4">
        <h2>识别结果：</h2>
        <ul>
          {characters.map((char) => (
            <li key={char.id}>
              {char.name} - 提及{char.mentions}次
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

## 下一步

- 阅读 [README.md](README.md) 了解详细功能
- 查看 [INTEGRATION.md](INTEGRATION.md) 学习集成方法
- 参考[人物识别方案.md](../../人物识别方案.md) 了解设计思路
- 参考 [NER模型选型.md](../../NER模型选型.md) 了解技术选型

## 常见问题

### 模型下载失败？

首次运行需要下载模型（1-2GB），如果网络问题：

1. 使用镜像源：
```bash
export HF_ENDPOINT=https://hf-mirror.com
```

2. 手动下载模型后放到缓存目录

### 识别速度慢？

- 首次运行需要加载模型，后续会快很多
- 考虑使用 GPU 加速
- 对长文本分块处理

### 识别不准确？

- 调整 `similarity_threshold` 参数
- 检查文本编码是否正确
- 确保文本格式规范（有标点分句）
