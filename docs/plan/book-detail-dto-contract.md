# 书籍详情 DTO 契约（v2）

> 路由：`GET /api/books/:id`
> 
> 更新日期：2026-03-01

## 查询参数

- `include=characters,segments,chapters,scripts,audioFiles`
- `include` 可选；未传时只返回基础信息 + 统计 + 最新任务

## 基础字段

```json
{
  "id": "string",
  "title": "string",
  "author": "string|null",
  "originalFilename": "string|null",
  "fileSize": "number|null",
  "totalWords": "number|null",
  "totalCharacters": "number",
  "totalSegments": "number",
  "totalChapters": "number",
  "encoding": "string|null",
  "fileFormat": "string|null",
  "status": "BookStatus",
  "metadata": "object",
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

## 统一统计字段（单一事实来源）

```json
{
  "counts": {
    "characters": "number",
    "chapters": "number",
    "segments": "number",
    "scripts": "number",
    "audioFiles": "number"
  },
  "stats": {
    "charactersCount": "number",
    "chaptersCount": "number",
    "segmentsCount": "number",
    "scriptsCount": "number",
    "audioFilesCount": "number"
  }
}
```

> 说明：`stats` 为历史兼容；新页面应优先消费 `counts`。

## 任务字段

```json
{
  "latestTask": {
    "id": "string",
    "taskType": "string",
    "status": "pending|processing|completed|failed",
    "progress": "number",
    "message": "string|null",
    "metadata": "object|null",
    "error": "string|null",
    "createdAt": "ISO date",
    "completedAt": "ISO date|null"
  },
  "processingTasks": ["latest first"]
}
```

## include 扩展字段

- `characters` -> `characterProfiles[]`
- `segments` -> `textSegments[]`
- `chapters` -> `chapters[]`
- `scripts` -> `scriptSentences[]`（含 `tone/strength/pauseAfter/ttsParameters`）
- `audioFiles` -> `audioFiles[]`（用于播放页，已过滤 `status=completed`）

## 兼容字段

- `_count`：保留给旧前端；新逻辑不应继续扩展该字段。
