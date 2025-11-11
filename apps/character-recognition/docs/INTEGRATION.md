# 集成指南

本文档说明如何将人物识别服务集成到主应用中。

## 服务架构

人物识别服务是一个独立的 Python/FastAPI 微服务，与主 Next.js 应用并行运行。

```
┌─────────────────┐         ┌──────────────────────────┐
│   Next.js Web   │────────>│ Character Recognition    │
│   (Port 3000)   │  HTTP   │   Service (Port 8001)    │
└─────────────────┘         └──────────────────────────┘
        │                              │
        │                              │
        ↓                              ↓
   PostgreSQL                      HanLP/Text2Vec
     Redis                            Models
```

## 本地开发

### 启动人物识别服务

```bash
cd apps/character-recognition

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py
```

服务将在 http://localhost:8001 启动。

### 在 Web 应用中调用

在 Next.js 应用中创建 API 客户端：

```typescript
// apps/web/src/lib/character-api.ts
export interface CharacterRecognitionOptions {
  enable_coreference?: boolean;
  enable_dialogue?: boolean;
  enable_relations?: boolean;
  similarity_threshold?: number;
  max_characters?: number;
}

export interface Character {
  id: string;
  name: string;
  aliases: string[];
  mentions: number;
  first_appearance_idx: number;
  gender?: string;
  roles: string[];
  quotes: number;
}

export interface CharacterRecognitionResult {
  characters: Character[];
  alias_map: Record<string, string>;
  relations: Array<{
    from: string;
    to: string;
    type: string;
    weight: number;
  }>;
  statistics: {
    total_characters: number;
    total_mentions: number;
    total_dialogues: number;
    processing_time: number;
    text_length: number;
    sentence_count: number;
  };
}

export async function recognizeCharacters(
  text: string,
  options?: CharacterRecognitionOptions
): Promise<CharacterRecognitionResult> {
  const apiUrl = process.env.CHARACTER_RECOGNITION_URL || 'http://localhost:8001';
  
  const response = await fetch(`${apiUrl}/api/recognize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      options: options || {}
    }),
  });

  if (!response.ok) {
    throw new Error(`Character recognition failed: ${response.statusText}`);
  }

  return response.json();
}
```

### 使用示例

```typescript
// apps/web/src/app/api/books/[id]/characters/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { recognizeCharacters } from '@/lib/character-api';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { text } = await request.json();
    
    const result = await recognizeCharacters(text, {
      enable_coreference: true,
      enable_dialogue: true,
      enable_relations: true,
      similarity_threshold: 0.8,
      max_characters: 50
    });
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Character recognition failed' },
      { status: 500 }
    );
  }
}
```

## Docker 部署

### 环境变量

在 `.env` 文件中配置：

```bash
# Character Recognition Service
CHARACTER_RECOGNITION_URL=http://character-recognition:8001
SIMILARITY_THRESHOLD=0.80
LOG_LEVEL=INFO
```

### 启动所有服务

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f character-recognition

# 测试服务
curl http://localhost:8001/health
```

## API 文档

服务启动后，访问交互式 API 文档：

- **Swagger UI**: http://localhost:8001/docs
- **ReDoc**: http://localhost:8001/redoc

## 性能优化

### 模型缓存

首次运行时，服务会下载 NLP 模型（约 1-2GB）。这些模型会缓存在：
- 本地: `~/.cache/huggingface` 和 `~/.cache/hanlp`
- Docker: `/root/.cache` volume

### 批量处理

对于大量文本，建议分块处理：

```typescript
async function recognizeCharactersInChunks(
  text: string,
  chunkSize: number = 10000
): Promise<CharacterRecognitionResult> {
  const chunks = splitTextIntoChunks(text, chunkSize);
  const results = await Promise.all(
    chunks.map(chunk => recognizeCharacters(chunk))
  );
  
  // 合并结果
  return mergeResults(results);
}
```

### 超时设置

对于长文本，建议增加超时时间：

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒

try {
  const result = await fetch(url, {
    signal: controller.signal,
    // ... other options
  });
} finally {
  clearTimeout(timeoutId);
}
```

## 故障排除

### 服务无法启动

检查日志：
```bash
docker-compose logs character-recognition
```

常见问题：
- 端口 8001 被占用
- 模型下载失败（网络问题）
- 内存不足（至少需要 4GB RAM）

### 识别结果不准确

调整配置参数：
- `similarity_threshold`: 降低阈值（0.7-0.8）以合并更多别名
- 使用更大的 NER 模型
- 添加自定义规则模板

### 性能问题

- 使用 GPU 加速（修改 requirements.txt 使用 GPU 版本）
- 减小批处理大小
- 启用结果缓存

## 监控

### 健康检查

```bash
curl http://localhost:8001/health
```

### 统计信息

```bash
curl http://localhost:8001/api/stats
```

### 日志

日志文件位置：
- 容器内: `/app/logs/app.log`
- 本地: `apps/character-recognition/logs/app.log`

## 后续开发

- [ ] 添加人物画像分析（性格、情绪）
- [ ] 关系图可视化
- [ ] 结果缓存优化
- [ ] WebSocket 支持（实时处理）
- [ ] 多语言支持
