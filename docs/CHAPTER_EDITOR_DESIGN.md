# 章节编辑/调整工具 - 功能设计文档

最后更新：`2025-02-15`

## 1. 概述

本文档规划了一套完整的章节编辑/调整工具系统，允许用户手动划分、合并、调整章节，提升文案处理体验和内容质量。

### 1.1 设计目标

- **灵活性**：支持手动创建、拆分、合并章节
- **准确性**：提供章节边界的精确调整能力
- **易用性**：直观的可视化界面，所见即所得
- **安全性**：操作可撤销，保留历史记录
- **一致性**：自动维护段落、台本、音频的关联关系

### 1.2 核心功能

1. **章节可视化编辑器** - 拖拽式章节边界调整
2. **章节拆分** - 将一个章节拆分为多个子章节
3. **章节合并** - 将多个章节合并为一个
4. **章节重命名** - 修改章节标题
5. **章节重排序** - 调整章节顺序
6. **段落重分配** - 在章节间移动段落
7. **章节删除与恢复** - 安全删除并支持撤销
8. **批量操作** - 支持选中多个章节进行批量操作

---

## 2. 数据模型分析

### 2.1 现有数据结构

基于 `prisma/schema.prisma` 的分析：

```prisma
model Book {
  id              String    @id @default(uuid())
  totalChapters   Int       @default(0)
  chapters        Chapter[]
  textSegments    TextSegment[]
  scriptSentences ScriptSentence[]
  audioFiles      AudioFile[]
}

model Chapter {
  id             String    @id @default(uuid())
  bookId         String
  chapterIndex   Int                      // 章节顺序
  title          String                   // 章节标题
  rawTitle       String?                  // 原始标题
  startPosition  Int       @default(0)    // 起始位置
  endPosition    Int       @default(0)    // 结束位置
  wordCount      Int?      @default(0)
  characterCount Int?      @default(0)
  totalSegments  Int       @default(0)
  status         String    @default("pending")
  metadata       Json?     @default("{}")

  segments        TextSegment[]
  scriptSentences ScriptSentence[]
  audioFiles      AudioFile[]

  @@unique([bookId, chapterIndex])
}

model TextSegment {
  id                String    @id @default(uuid())
  bookId            String
  chapterId         String?              // 可选：关联章节
  segmentIndex      Int                  // 全局段落顺序
  orderIndex        Int                  // 全局排序
  chapterOrderIndex Int?                 // 章节内排序
  content           String
  wordCount         Int?

  scriptSentences   ScriptSentence[]
  audioFiles        AudioFile[]
}

model ScriptSentence {
  id          String    @id @default(uuid())
  bookId      String
  segmentId   String
  chapterId   String?                    // 可选：关联章节

  audioFiles  AudioFile[]
}

model AudioFile {
  id          String    @id @default(uuid())
  bookId      String
  sentenceId  String?
  segmentId   String?
  chapterId   String?                    // 可选：关联章节
}
```

### 2.2 关键约束和关系

1. **Chapter.chapterIndex** 必须在同一 `bookId` 下唯一（`@@unique([bookId, chapterIndex])`）
2. **级联删除**：删除 Chapter 时，关联的 segments/sentences/audioFiles 的 `chapterId` 会被设置为 NULL（`onDelete: SetNull/Cascade`）
3. **排序字段**：
   - `Chapter.chapterIndex` - 章节全局顺序
   - `TextSegment.orderIndex` - 段落全局顺序
   - `TextSegment.chapterOrderIndex` - 段落在章节内的顺序

### 2.3 需要新增的数据结构

#### 2.3.1 章节操作历史表

用于记录章节编辑操作，支持撤销/恢复：

```prisma
model ChapterEditHistory {
  id            String    @id @default(uuid())
  bookId        String
  operationType String    // 'split', 'merge', 'rename', 'reorder', 'delete', 'move_segments'
  operationData Json      // 操作的详细数据
  affectedChapterIds String[]  // 受影响的章节ID列表
  beforeSnapshot Json      // 操作前的快照
  afterSnapshot  Json      // 操作后的快照
  createdBy      String?   // 操作用户（可选）
  createdAt      DateTime  @default(now())

  book          Book      @relation(fields: [bookId], references: [id], onDelete: Cascade)

  @@index([bookId, createdAt])
  @@map("chapter_edit_history")
}
```

---

## 3. API 设计

### 3.1 章节管理 API

#### 3.1.1 获取章节详情

```http
GET /api/books/{bookId}/chapters/{chapterId}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "chapter": {
      "id": "uuid",
      "chapterIndex": 1,
      "title": "第一章 开篇",
      "rawTitle": "第一章 开篇",
      "startPosition": 0,
      "endPosition": 5000,
      "wordCount": 2500,
      "characterCount": 5000,
      "totalSegments": 12,
      "status": "processed",
      "metadata": {}
    },
    "segments": [
      {
        "id": "uuid",
        "chapterOrderIndex": 0,
        "content": "段落内容...",
        "wordCount": 200,
        "hasScript": true,
        "hasAudio": false
      }
    ],
    "statistics": {
      "scriptSentencesCount": 45,
      "audioFilesCount": 0,
      "charactersCount": 3
    }
  }
}
```

#### 3.1.2 创建新章节

```http
POST /api/books/{bookId}/chapters
```

**请求体：**
```json
{
  "title": "新章节标题",
  "afterChapterIndex": 1,  // 在第1章后插入
  "segmentIds": ["uuid1", "uuid2"],  // 可选：分配段落
  "autoReindex": true  // 是否自动重新索引后续章节
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "chapter": { /* 新章节数据 */ },
    "reindexedChapters": [
      { "id": "uuid", "oldIndex": 2, "newIndex": 3 }
    ]
  }
}
```

#### 3.1.3 更新章节信息

```http
PATCH /api/books/{bookId}/chapters/{chapterId}
```

**请求体：**
```json
{
  "title": "修改后的标题",
  "metadata": {
    "customField": "value"
  }
}
```

#### 3.1.4 删除章节

```http
DELETE /api/books/{bookId}/chapters/{chapterId}
```

**查询参数：**
- `keepSegments=true` - 保留段落但解除关联
- `deleteSegments=false` - 同时删除段落（默认不删除）

**响应：**
```json
{
  "success": true,
  "data": {
    "deletedChapter": { "id": "uuid", "title": "..." },
    "unassignedSegments": 12,  // 解除关联的段落数
    "historyId": "uuid"  // 历史记录ID，用于撤销
  }
}
```

---

### 3.2 章节操作 API

#### 3.2.1 拆分章节

```http
POST /api/books/{bookId}/chapters/{chapterId}/split
```

**请求体：**
```json
{
  "splitPoints": [
    {
      "afterSegmentId": "uuid1",  // 在此段落后拆分
      "newChapterTitle": "第一章（下）"
    }
  ],
  "autoReindex": true
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "originalChapter": {
      "id": "uuid",
      "title": "第一章（上）",
      "totalSegments": 6
    },
    "newChapters": [
      {
        "id": "uuid2",
        "title": "第一章（下）",
        "chapterIndex": 2,
        "totalSegments": 6
      }
    ],
    "historyId": "uuid"
  }
}
```

#### 3.2.2 合并章节

```http
POST /api/books/{bookId}/chapters/merge
```

**请求体：**
```json
{
  "chapterIds": ["uuid1", "uuid2", "uuid3"],  // 要合并的章节ID（按顺序）
  "targetTitle": "第一章 完整版",
  "keepFirstChapter": true,  // 保留第一个章节，其他章节的段落迁移过来
  "autoReindex": true
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "mergedChapter": {
      "id": "uuid1",
      "title": "第一章 完整版",
      "chapterIndex": 1,
      "totalSegments": 24,
      "wordCount": 12000
    },
    "deletedChapterIds": ["uuid2", "uuid3"],
    "historyId": "uuid"
  }
}
```

#### 3.2.3 重排序章节

```http
POST /api/books/{bookId}/chapters/reorder
```

**请求体：**
```json
{
  "chapterOrders": [
    { "chapterId": "uuid1", "newIndex": 0 },
    { "chapterId": "uuid2", "newIndex": 1 },
    { "chapterId": "uuid3", "newIndex": 2 }
  ]
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "reorderedChapters": [
      { "id": "uuid", "oldIndex": 2, "newIndex": 0 }
    ],
    "historyId": "uuid"
  }
}
```

#### 3.2.4 移动段落到其他章节

```http
POST /api/books/{bookId}/segments/move
```

**请求体：**
```json
{
  "segmentIds": ["uuid1", "uuid2"],
  "targetChapterId": "uuid3",
  "insertAfterSegmentId": "uuid4",  // 可选：插入到目标章节的指定位置
  "updateChapterOrderIndex": true  // 自动更新章节内排序
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "movedSegments": 2,
    "sourceChapter": {
      "id": "uuid1",
      "totalSegments": 10
    },
    "targetChapter": {
      "id": "uuid3",
      "totalSegments": 14
    },
    "historyId": "uuid"
  }
}
```

---

### 3.3 历史记录与撤销 API

#### 3.3.1 获取操作历史

```http
GET /api/books/{bookId}/chapters/history?limit=20&offset=0
```

**响应：**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "operationType": "split",
        "createdAt": "2025-02-15T10:30:00Z",
        "summary": "将"第一章"拆分为2个章节",
        "canUndo": true
      }
    ],
    "pagination": {
      "total": 45,
      "limit": 20,
      "offset": 0
    }
  }
}
```

#### 3.3.2 撤销操作

```http
POST /api/books/{bookId}/chapters/history/{historyId}/undo
```

**响应：**
```json
{
  "success": true,
  "data": {
    "restoredState": {
      "affectedChapters": ["uuid1", "uuid2"],
      "restoredSegments": 12
    },
    "message": "操作已撤销"
  }
}
```

---

## 4. 前端 UI 设计

### 4.1 章节编辑器主界面

#### 4.1.1 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│  [返回书籍]  《书名》- 章节编辑器          [保存] [撤销] [重做] │
├────────────────┬────────────────────────────────────────────┤
│                │                                            │
│  章节列表       │         章节内容预览                        │
│                │                                            │
│  ▼ 第一章      │  ┌────────────────────────────────────┐   │
│    [12 段落]   │  │ 第一章 开篇                        │   │
│    [编辑]      │  │ [重命名] [拆分] [合并] [删除]      │   │
│    [拆分]      │  └────────────────────────────────────┘   │
│                │                                            │
│  ▼ 第二章      │  段落列表 (可拖拽排序)                      │
│    [8 段落]    │  ┌─ 段落 1 ───────────────────────┐        │
│    [编辑]      │  │ □ 很久很久以前，在一个遥远的...  │        │
│    [拆分]      │  │   [200字] [有台本] [无音频]      │        │
│                │  │   [移动到其他章节] [在此处拆分]  │        │
│  ▶ 第三章      │  └──────────────────────────────┘        │
│    [15 段落]   │  ┌─ 段落 2 ───────────────────────┐        │
│                │  │ □ 村庄里住着一位勇敢的少年...    │        │
│  + 新增章节    │  │   [180字] [有台本] [有音频]      │        │
│                │  └──────────────────────────────┘        │
│                │  ...                                       │
│                │                                            │
│                │  [+ 添加段落到此章节]                       │
└────────────────┴────────────────────────────────────────────┘
```

#### 4.1.2 组件列表

1. **ChapterEditorPage** - 主页面容器
   - 路径：`/books/[id]/chapters/editor`
   - 状态管理：章节列表、选中章节、操作历史栈

2. **ChapterListPanel** - 左侧章节列表
   - 显示所有章节，支持折叠/展开
   - 拖拽排序章节
   - 快速操作按钮（编辑、拆分、删除）

3. **ChapterContentPanel** - 右侧内容预览
   - 显示选中章节的段落列表
   - 段落拖拽排序
   - 段落选择（多选支持批量操作）

4. **ChapterActionToolbar** - 操作工具栏
   - 重命名章节
   - 拆分章节（弹窗选择拆分点）
   - 合并章节（选择要合并的章节）
   - 删除章节
   - 撤销/重做

5. **ChapterSplitModal** - 拆分章节弹窗
   - 显示段落列表
   - 选择拆分点（支持多个拆分点）
   - 为新章节输入标题

6. **ChapterMergeModal** - 合并章节弹窗
   - 选择要合并的章节（多选）
   - 预览合并后的段落顺序
   - 输入合并后的标题

7. **SegmentMoveModal** - 移动段落弹窗
   - 选择目标章节
   - 选择插入位置（章节内的哪个段落后）

---

### 4.2 交互流程

#### 4.2.1 拆分章节流程

```
用户操作流程：
1. 点击章节列表中的"拆分"按钮
2. 弹出 ChapterSplitModal
3. 显示该章节的所有段落
4. 用户选择拆分点（点击段落间的"在此处拆分"按钮）
5. 为新章节输入标题（自动生成默认标题）
6. 点击"确认拆分"
7. 调用 API：POST /api/books/{id}/chapters/{chapterId}/split
8. 刷新章节列表
9. 显示成功提示

数据更新：
- 原章节的 totalSegments 减少
- 创建新章节记录
- 更新受影响段落的 chapterId 和 chapterOrderIndex
- 后续章节的 chapterIndex +1
- 创建历史记录
```

#### 4.2.2 合并章节流程

```
用户操作流程：
1. 在章节列表中选中多个章节（Checkbox 多选）
2. 点击工具栏的"合并章节"按钮
3. 弹出 ChapterMergeModal
4. 显示将要合并的章节列表（可调整顺序）
5. 预览合并后的段落总数
6. 输入合并后的章节标题
7. 选择保留哪个章节（其他章节将被删除）
8. 点击"确认合并"
9. 调用 API：POST /api/books/{id}/chapters/merge
10. 刷新章节列表
11. 显示成功提示

数据更新：
- 保留的章节更新 totalSegments、wordCount、characterCount
- 其他章节被删除（软删除或硬删除）
- 被合并章节的段落更新 chapterId 和 chapterOrderIndex
- 后续章节的 chapterIndex 调整
- 创建历史记录
```

#### 4.2.3 移动段落流程

```
用户操作流程：
1. 在章节内容面板中选中一个或多个段落（Checkbox）
2. 点击"移动到其他章节"按钮
3. 弹出 SegmentMoveModal
4. 选择目标章节
5. 选择插入位置（可选）
6. 点击"确认移动"
7. 调用 API：POST /api/books/{id}/segments/move
8. 刷新当前章节和目标章节的段落列表
9. 显示成功提示

数据更新：
- 更新段落的 chapterId
- 重新计算两个章节的 chapterOrderIndex
- 更新两个章节的 totalSegments
- 创建历史记录
```

#### 4.2.4 撤销操作流程

```
用户操作流程：
1. 点击工具栏的"撤销"按钮
2. 系统加载最近一条历史记录
3. 显示撤销确认弹窗（显示将要撤销的操作）
4. 用户确认
5. 调用 API：POST /api/books/{id}/chapters/history/{historyId}/undo
6. 根据历史记录还原数据状态
7. 刷新界面
8. 显示成功提示

数据更新：
- 根据 beforeSnapshot 还原章节和段落状态
- 标记历史记录为已撤销
- 可选：创建"重做"记录
```

---

## 5. 后端实现要点

### 5.1 核心服务类

#### 5.1.1 ChapterEditorService

```typescript
export class ChapterEditorService {
  /**
   * 拆分章节
   */
  async splitChapter(
    bookId: string,
    chapterId: string,
    splitPoints: Array<{
      afterSegmentId: string
      newChapterTitle: string
    }>,
    options: { autoReindex?: boolean } = {}
  ): Promise<ChapterSplitResult>

  /**
   * 合并章节
   */
  async mergeChapters(
    bookId: string,
    chapterIds: string[],
    targetTitle: string,
    options: {
      keepFirstChapter?: boolean
      autoReindex?: boolean
    } = {}
  ): Promise<ChapterMergeResult>

  /**
   * 重排序章节
   */
  async reorderChapters(
    bookId: string,
    chapterOrders: Array<{ chapterId: string; newIndex: number }>
  ): Promise<ChapterReorderResult>

  /**
   * 移动段落
   */
  async moveSegments(
    bookId: string,
    segmentIds: string[],
    targetChapterId: string,
    insertAfterSegmentId?: string
  ): Promise<SegmentMoveResult>

  /**
   * 创建历史记录
   */
  private async createHistory(
    bookId: string,
    operationType: string,
    operationData: any,
    beforeSnapshot: any,
    afterSnapshot: any
  ): Promise<string>

  /**
   * 撤销操作
   */
  async undoOperation(
    bookId: string,
    historyId: string
  ): Promise<UndoResult>

  /**
   * 重新索引章节
   * 确保 chapterIndex 连续且从 0 开始
   */
  private async reindexChapters(
    bookId: string,
    startFromIndex: number = 0
  ): Promise<void>

  /**
   * 重新索引段落
   * 确保章节内的 chapterOrderIndex 连续且从 0 开始
   */
  private async reindexSegments(chapterId: string): Promise<void>

  /**
   * 更新章节统计信息
   */
  private async updateChapterStats(chapterId: string): Promise<void>
}
```

### 5.2 数据一致性保障

#### 5.2.1 事务处理

所有章节编辑操作必须在数据库事务中执行，确保原子性：

```typescript
await prisma.$transaction(async (tx) => {
  // 1. 创建操作前快照
  const beforeSnapshot = await captureChapterSnapshot(chapterId)

  // 2. 执行主要操作
  await performChapterOperation(tx, operationData)

  // 3. 更新关联数据
  await updateRelatedData(tx, affectedIds)

  // 4. 创建历史记录
  await createHistoryRecord(tx, beforeSnapshot, afterSnapshot)

  // 5. 重新索引
  if (options.autoReindex) {
    await reindexChapters(tx, bookId)
  }
})
```

#### 5.2.2 级联更新

章节变更时，需要级联更新相关数据：

```typescript
// 拆分章节时的级联更新
async function cascadeUpdateOnSplit(
  originalChapterId: string,
  newChapterId: string,
  movedSegmentIds: string[]
) {
  // 1. 更新段落的 chapterId
  await prisma.textSegment.updateMany({
    where: { id: { in: movedSegmentIds } },
    data: { chapterId: newChapterId }
  })

  // 2. 更新台本句子的 chapterId
  await prisma.scriptSentence.updateMany({
    where: { segmentId: { in: movedSegmentIds } },
    data: { chapterId: newChapterId }
  })

  // 3. 更新音频文件的 chapterId
  await prisma.audioFile.updateMany({
    where: { segmentId: { in: movedSegmentIds } },
    data: { chapterId: newChapterId }
  })

  // 4. 重新计算两个章节的统计信息
  await updateChapterStats(originalChapterId)
  await updateChapterStats(newChapterId)

  // 5. 重新索引两个章节的段落顺序
  await reindexSegments(originalChapterId)
  await reindexSegments(newChapterId)
}
```

### 5.3 性能优化

#### 5.3.1 批量操作优化

```typescript
// 使用 updateMany 而不是循环 update
await prisma.chapter.updateMany({
  where: {
    bookId,
    chapterIndex: { gte: startIndex }
  },
  data: {
    chapterIndex: { increment: offset }
  }
})
```

#### 5.3.2 快照优化

```typescript
// 只保存必要的字段，减少快照大小
const snapshot = {
  chapters: chapters.map(ch => ({
    id: ch.id,
    chapterIndex: ch.chapterIndex,
    title: ch.title,
    totalSegments: ch.totalSegments
  })),
  segments: segments.map(seg => ({
    id: seg.id,
    chapterId: seg.chapterId,
    chapterOrderIndex: seg.chapterOrderIndex
  }))
}
```

---

## 6. 安全性与权限控制

### 6.1 操作权限

- 只有书籍所有者可以编辑章节
- 考虑添加"编辑锁"，防止多人同时编辑同一本书

### 6.2 数据验证

```typescript
// 拆分章节前的验证
async function validateSplitOperation(
  chapterId: string,
  splitPoints: SplitPoint[]
) {
  // 1. 验证章节是否存在
  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } })
  if (!chapter) throw new Error('章节不存在')

  // 2. 验证拆分点的段落是否属于该章节
  const segmentIds = splitPoints.map(sp => sp.afterSegmentId)
  const segments = await prisma.textSegment.findMany({
    where: { id: { in: segmentIds }, chapterId }
  })
  if (segments.length !== segmentIds.length) {
    throw new Error('拆分点段落不属于该章节')
  }

  // 3. 验证拆分点顺序是否正确
  const orderedSegments = segments.sort(
    (a, b) => a.chapterOrderIndex! - b.chapterOrderIndex!
  )
  // ... 更多验证逻辑
}
```

### 6.3 历史记录限制

- 限制历史记录保留时间（如 30 天）
- 限制历史记录数量（如最多保留 100 条）
- 提供清理过期历史的定时任务

---

## 7. 测试计划

### 7.1 单元测试

- `ChapterEditorService.splitChapter()` - 拆分逻辑测试
- `ChapterEditorService.mergeChapters()` - 合并逻辑测试
- `ChapterEditorService.reorderChapters()` - 重排序测试
- `ChapterEditorService.undoOperation()` - 撤销功能测试

### 7.2 集成测试

- 章节拆分后，段落、台本、音频的关联关系是否正确
- 章节合并后，chapterIndex 是否连续
- 撤销操作后，数据是否完全恢复
- 多个章节操作的事务一致性

### 7.3 性能测试

- 大量章节（100+）的重排序性能
- 大量段落（1000+）的移动性能
- 历史记录查询性能

---

## 8. 实施计划

### 8.1 第一阶段：基础功能（1-2周）

- [ ] 数据模型扩展（添加 ChapterEditHistory 表）
- [ ] 后端服务类实现（ChapterEditorService）
- [ ] 基础 API 实现（创建、更新、删除章节）
- [ ] 前端章节编辑器主界面
- [ ] 章节列表组件和内容预览组件

### 8.2 第二阶段：高级操作（2-3周）

- [ ] 章节拆分功能（API + UI）
- [ ] 章节合并功能（API + UI）
- [ ] 段落移动功能（API + UI）
- [ ] 章节重排序功能（拖拽支持）
- [ ] 批量操作支持

### 8.3 第三阶段：历史与优化（1周）

- [ ] 操作历史记录功能
- [ ] 撤销/重做功能
- [ ] 性能优化（批量操作、快照优化）
- [ ] 单元测试和集成测试
- [ ] 文档更新

### 8.4 第四阶段：打磨与发布（1周）

- [ ] UI/UX 优化
- [ ] 错误处理和用户提示
- [ ] 边界情况处理
- [ ] Beta 测试
- [ ] 正式发布

**总计：5-7周**

---

## 9. 未来扩展方向

### 9.1 AI 辅助章节划分

- 基于内容语义自动建议章节拆分点
- 智能章节标题生成

### 9.2 协作编辑

- 多人同时编辑不同章节
- 实时同步和冲突解决

### 9.3 版本管理

- 类似 Git 的章节版本控制
- 分支和合并功能

### 9.4 导入/导出

- 导入外部章节结构（如 JSON、CSV）
- 导出章节结构模板

---

## 10. 总结

本设计文档提供了一套完整的章节编辑/调整工具解决方案，包括：

✅ **数据模型** - 扩展 Prisma Schema，添加历史记录表
✅ **API 设计** - 完整的 RESTful API，支持所有章节操作
✅ **前端 UI** - 可视化编辑器，拖拽式交互
✅ **后端服务** - 事务处理、级联更新、数据一致性保障
✅ **安全性** - 权限控制、数据验证、操作限制
✅ **测试计划** - 单元测试、集成测试、性能测试
✅ **实施计划** - 分阶段实施，5-7周完成

该工具将显著提升用户的文案处理体验，使章节管理更加灵活、准确和高效。
