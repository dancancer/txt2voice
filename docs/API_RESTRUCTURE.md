# API 接口重构文档

## 概述

为了优化性能和减少数据传输量，我们将原有的 `/api/books/[id]` 接口拆分成了多个专门的接口，每个接口负责特定的数据类型并支持分页。

## 新的接口架构

### 1. 书籍基本信息接口
**路径**: `GET /api/books/[id]`

**功能**: 获取书籍的基本信息和统计数据
- 返回书籍基本信息（标题、作者、状态等）
- 包含统计数据（角色数、分段数、台本数、音频文件数）
- 支持可选的详细数据包含参数

**查询参数**:
- `include`: 可选，逗号分隔的字符串，可包含 `characters`, `segments`, `scripts`

**示例**:
```bash
# 获取基本信息
GET /api/books/[id]

# 获取基本信息 + 前10个角色
GET /api/books/[id]?include=characters

# 获取基本信息 + 前10个分段 + 前20个台本
GET /api/books/[id]?include=characters,segments,scripts
```

### 2. 角色列表接口
**路径**: `GET /api/books/[id]/characters`

**功能**: 获取书籍的角色列表（分页）
- 支持分页
- 支持按活跃状态过滤
- 支持搜索
- 包含别名和语音绑定信息

**查询参数**:
- `page`: 页码（默认: 1）
- `limit`: 每页数量（默认: 20，最大: 100）
- `offset`: 偏移量（与page二选一）
- `isActive`: 按活跃状态过滤（true/false）
- `search`: 搜索角色名称或别名

**示例**:
```bash
# 获取前20个活跃角色
GET /api/books/[id]/characters

# 获取第2页，每页10个
GET /api/books/[id]/characters?page=2&limit=10

# 搜索包含"黄"的角色
GET /api/books/[id]/characters?search=黄

# 获取非活跃角色
GET /api/books/[id]/characters?isActive=false
```

**POST**: 创建新角色
```bash
POST /api/books/[id]/characters
Content-Type: application/json

{
  "canonicalName": "新角色",
  "genderHint": "female",
  "ageHint": 25,
  "emotionBaseline": "neutral"
}
```

### 3. 台本列表接口
**路径**: `GET /api/books/[id]/scripts`

**功能**: 获取书籍的台本句子列表（分页）
- 支持分页
- 支持按角色、分段过滤
- 支持搜索和语气过滤
- 包含角色和分段信息

**查询参数**:
- `page`: 页码（默认: 1）
- `limit`: 每页数量（默认: 20，最大: 100）
- `offset`: 偏移量
- `characterId`: 按角色ID过滤
- `segmentId`: 按分段ID过滤
- `search`: 搜索台本内容
- `tone`: 按语气过滤

**示例**:
```bash
# 获取前20个台本句子
GET /api/books/[id]/scripts

# 获取特定角色的台本
GET /api/books/[id]/scripts?characterId=xxx

# 搜索包含"你好"的台本
GET /api/books/[id]/scripts?search=你好

# 获取愤怒语气的台本
GET /api/books/[id]/scripts?tone=angry
```

**POST**: 创建新台本句子
```bash
POST /api/books/[id]/scripts
Content-Type: application/json

{
  "segmentId": "分段ID",
  "characterId": "角色ID",
  "text": "台本内容",
  "tone": "neutral",
  "strength": 75
}
```

**PUT**: 批量更新台本句子
```bash
PUT /api/books/[id]/scripts
Content-Type: application/json

{
  "scripts": [
    {
      "id": "台本ID1",
      "text": "更新的内容",
      "tone": "happy"
    },
    {
      "id": "台本ID2", 
      "characterId": "新角色ID"
    }
  ]
}
```

### 4. 分段列表接口
**路径**: `GET /api/books/[id]/segments`

**功能**: 获取书籍的分段列表（分页）
- 支持分页
- 支持按状态、类型过滤
- 支持搜索和音频过滤
- 包含台本句子和音频文件统计

**查询参数**:
- `page`: 页码（默认: 1）
- `limit`: 每页数量（默认: 20，最大: 100）
- `offset`: 偏移量
- `status`: 按状态过滤
- `segmentType`: 按分段类型过滤
- `search`: 搜索分段内容
- `hasAudio`: 按是否有音频过滤（true/false）

**示例**:
```bash
# 获取前20个分段
GET /api/books/[id]/segments

# 获取待处理的分段
GET /api/books/[id]/segments?status=pending

# 获取已有音频的分段
GET /api/books/[id]/segments?hasAudio=true

# 搜索包含"第一章"的分段
GET /api/books/[id]/segments?search=第一章
```

**POST**: 创建新分段
```bash
POST /api/books/[id]/segments
Content-Type: application/json

{
  "content": "分段内容",
  "segmentIndex": 1,
  "wordCount": 100,
  "segmentType": "chapter"
}
```

**PUT**: 批量更新分段
```bash
PUT /api/books/[id]/segments
Content-Type: application/json

{
  "segments": [
    {
      "id": "分段ID1",
      "content": "更新的内容",
      "status": "completed"
    }
  ]
}
```

## 分页响应格式

所有支持分页的接口都返回统一的格式：

```json
{
  "success": true,
  "data": {
    "data": [...], // 实际数据数组
    "pagination": {
      "page": 1,           // 当前页码
      "limit": 20,          // 每页数量
      "total": 100,         // 总记录数
      "totalPages": 5,       // 总页数
      "hasNext": true,       // 是否有下一页
      "hasPrev": false       // 是否有上一页
    }
  }
}
```

## 性能优化

### 1. 数据传输量减少
- 原接口返回所有数据，新接口按需返回
- 分页限制单次查询的数据量
- 字段选择减少不必要的数据传输

### 2. 查询优化
- 使用数据库索引优化查询性能
- 支持精确过滤减少数据扫描
- 统计查询使用 COUNT 优化

### 3. 缓存友好
- 分页数据易于缓存
- 独立接口支持细粒度缓存
- 统计数据变化频率低，适合长期缓存

## 客户端使用

### 使用 API 客户端工具

```typescript
import { 
  getBookBasicInfo, 
  getBookCharacters, 
  getBookScripts, 
  getBookSegments 
} from '@/lib/book-api'

// 获取书籍基本信息
const book = await getBookBasicInfo(bookId)

// 获取角色列表（分页）
const characters = await getBookCharacters(bookId, {
  page: 1,
  limit: 10,
  search: '黄蓉'
})

// 获取台本列表（分页）
const scripts = await getBookScripts(bookId, {
  page: 1,
  limit: 20,
  characterId: 'character-id'
})

// 获取分段列表（分页）
const segments = await getBookSegments(bookId, {
  page: 1,
  limit: 15,
  status: 'pending'
})
```

## 迁移指南

### 从原接口迁移

1. **获取书籍信息**:
   ```typescript
   // 原来
   const response = await fetch(`/api/books/${id}`)
   const book = response.data // 包含所有数据
   
   // 现在
   const book = await getBookBasicInfo(id)
   const stats = book.stats // 统计信息
   
   // 需要详细数据时
   const bookWithCharacters = await getBookBasicInfo(id, ['characters'])
   ```

2. **获取角色列表**:
   ```typescript
   // 原来
   const book = await fetch(`/api/books/${id}`)
   const characters = book.characterProfiles
   
   // 现在
   const characters = await getBookCharacters(id, { page: 1, limit: 20 })
   ```

3. **获取台本列表**:
   ```typescript
   // 原来
   const book = await fetch(`/api/books/${id}`)
   const scripts = book.scriptSentences
   
   // 现在
   const scripts = await getBookScripts(id, { page: 1, limit: 20 })
   ```

4. **获取分段列表**:
   ```typescript
   // 原来
   const book = await fetch(`/api/books/${id}`)
   const segments = book.textSegments
   
   // 现在
   const segments = await getBookSegments(id, { page: 1, limit: 20 })
   ```

## 向后兼容性

为了保持向后兼容，原有的 `/api/books/[id]` 接口仍然存在，但：
- 默认只返回基本信息和统计数据
- 通过 `include` 参数可以获取详细数据
- 详细数据有数量限制（角色10个，分段10个，台本20个）

建议逐步迁移到新的专门接口以获得更好的性能和灵活性。
