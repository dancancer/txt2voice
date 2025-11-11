# 统一角色识别端点

## 概述

角色识别功能已统一到 `/api/books/[id]/characters/analyze` 端点，实现了智能降级机制。

## 工作流程

```
┌─────────────────────────────────────┐
│  POST /api/books/[id]/characters/   │
│           analyze                    │
└──────────────┬──────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ 检查本地服务健康状态  │
    └──────────┬───────────┘
               │
         ┌─────┴─────┐
         │           │
    ✓ 可用      ✗ 不可用
         │           │
         ▼           ▼
┌────────────────┐  ┌──────────────┐
│ 本地服务识别    │  │ LLM 服务识别  │
│ (免费、快速)    │  │ (付费、详细)  │
└────────────────┘  └──────────────┘
```

## 识别方法对比

### 本地服务 (character-recognition)

**优点：**
- ✅ 免费使用
- ✅ 处理速度快
- ✅ 基于 HanLP 的专业 NLP 模型
- ✅ 支持共指消解、对话识别、关系提取
- ✅ 无需外部 API 密钥

**特点：**
- 识别角色名称和别名
- 统计出现频率和对话次数
- 推断角色重要性
- 提取角色关系

**适用场景：**
- 大批量文本处理
- 成本敏感的场景
- 需要快速响应的场景

### LLM 服务 (OpenAI/DeepSeek)

**优点：**
- ✅ 详细的角色描述
- ✅ 性格分析
- ✅ 情感分析
- ✅ 对话风格识别
- ✅ 体裁和语调识别

**缺点：**
- ❌ 需要 API 密钥
- ❌ 有使用成本
- ❌ 处理速度较慢
- ❌ 依赖外部服务

**适用场景：**
- 需要深度分析的场景
- 对角色描述要求高的场景
- 本地服务不可用时的降级方案

## API 使用

### 启动角色识别

```bash
POST /api/books/{bookId}/characters/analyze
```

**响应：**
```json
{
  "success": true,
  "data": {
    "taskId": "task-uuid",
    "message": "角色分析任务已启动"
  }
}
```

### 查询识别状态

```bash
GET /api/books/{bookId}/characters/analyze
```

**响应：**
```json
{
  "success": true,
  "data": {
    "bookStatus": "analyzed",
    "hasCharacters": true,
    "characterCount": 15,
    "mainCharacterCount": 3,
    "analysisStatus": "completed",
    "analysisProgress": 100
  }
}
```

### 获取详细结果

```bash
GET /api/books/{bookId}/characters/analyze?includeResults=true
```

**响应：**
```json
{
  "success": true,
  "data": {
    "bookStatus": "analyzed",
    "characterCount": 15,
    "characters": [
      {
        "id": "char-uuid",
        "name": "张三",
        "description": "提及50次，对话30次",
        "gender": "male",
        "importance": "main",
        "aliases": ["小张", "张先生"],
        "dialogueCount": 30
      }
    ]
  }
}
```

## 元数据标记

识别完成后，书籍的 `metadata` 字段会包含识别方法标记：

### 本地服务识别

```json
{
  "analysisCompletedAt": "2025-11-11T15:10:00Z",
  "characterCount": 15,
  "totalMentions": 250,
  "totalDialogues": 120,
  "processingTime": 5.2,
  "recognitionMethod": "local"
}
```

### LLM 服务识别

```json
{
  "analysisCompletedAt": "2025-11-11T15:10:00Z",
  "characterCount": 15,
  "mainCharacterCount": 3,
  "dialogueCount": 120,
  "genre": "武侠",
  "tone": "激昂",
  "recognitionMethod": "llm"
}
```

## 配置

### 环境变量

```bash
# 本地服务配置
CHARACTER_RECOGNITION_URL=http://character-recognition:8001

# LLM 服务配置（降级使用）
LLM_PROVIDER=custom
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
```

### Docker Compose

本地服务会自动启动：

```yaml
services:
  character-recognition:
    build:
      context: .
      dockerfile: apps/character-recognition/Dockerfile
    ports:
      - "8001:8001"
    environment:
      SIMILARITY_THRESHOLD: 0.80
```

## 降级触发条件

以下情况会触发降级到 LLM 服务：

1. **本地服务健康检查失败**
   - 服务未启动
   - 网络连接问题
   - 服务响应超时

2. **识别过程异常**
   - 服务内部错误
   - 请求超时
   - 数据格式错误

3. **环境配置问题**
   - `CHARACTER_RECOGNITION_URL` 未配置
   - 服务端口不可达

## 监控和日志

### 日志示例

**本地服务成功：**
```
使用本地服务识别角色 { bookId, textLength, segmentCount }
本地服务识别完成 { characterCount, processingTime }
使用本地 character-recognition 服务完成角色识别
```

**降级到 LLM：**
```
本地识别服务失败，将降级到 LLM { error }
本地服务不可用，降级使用 LLM 服务: TIMEOUT
开始分段分析 (LLM)
```

### 任务进度消息

- `5%` - 检查本地识别服务
- `10%` - 使用本地服务识别角色 / 降级到 LLM 服务
- `30%` - 调用本地识别服务
- `70%` - 保存识别结果
- `90%` - 更新书籍状态
- `100%` - 识别完成

## 迁移指南

### 从旧的 `/recognize` 端点迁移

旧端点 `/api/books/[id]/characters/recognize` 仍然可用，但建议使用新的统一端点：

**旧方式：**
```javascript
// 只能使用本地服务
POST /api/books/{id}/characters/recognize
```

**新方式：**
```javascript
// 自动选择最佳服务
POST /api/books/{id}/characters/analyze
```

### 前端代码更新

```typescript
// 旧代码
const response = await fetch(`/api/books/${bookId}/characters/recognize`, {
  method: 'POST'
})

// 新代码（推荐）
const response = await fetch(`/api/books/${bookId}/characters/analyze`, {
  method: 'POST'
})
```

## 最佳实践

1. **优先使用统一端点**
   - 自动选择最优服务
   - 内置降级保障
   - 统一的错误处理

2. **监控识别方法**
   - 检查 `metadata.recognitionMethod` 了解使用的服务
   - 统计本地服务可用率
   - 优化服务配置

3. **成本控制**
   - 确保本地服务正常运行以避免 LLM 费用
   - 设置 LLM API 使用限额
   - 监控 API 调用次数

4. **性能优化**
   - 本地服务处理速度更快
   - 批量处理时优先保证本地服务可用
   - 合理设置超时时间

## 故障排查

### 本地服务不可用

**检查服务状态：**
```bash
curl http://localhost:8001/health
```

**查看服务日志：**
```bash
docker logs txt2voice-character-recognition
```

**重启服务：**
```bash
docker-compose restart character-recognition
```

### LLM 服务失败

**检查环境变量：**
```bash
echo $LLM_API_KEY
echo $LLM_BASE_URL
```

**测试 API 连接：**
```bash
curl -H "Authorization: Bearer $LLM_API_KEY" \
     $LLM_BASE_URL/models
```

## 未来改进

- [ ] 支持混合模式：本地服务识别 + LLM 增强描述
- [ ] 添加缓存机制，避免重复识别
- [ ] 支持增量识别，只处理新增文本
- [ ] 提供识别质量评分
- [ ] 支持用户手动选择识别方法
