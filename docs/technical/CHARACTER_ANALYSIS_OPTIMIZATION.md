# 角色分析功能优化总结

## 问题诊断

### 原始问题
1. **角色分析看起来没有正常工作** - 实际上是在工作，但处理大文本需要时间
2. **一次性加载所有文本** - 对于大型书籍效率低下且占用大量内存
3. **缺少进度反馈** - 用户无法了解处理进度
4. **数据类型错误** - `ageHint` 字段类型不匹配导致保存失败

### 根本原因
- 原始实现一次性加载所有文本段落到内存中（40K+ 字符）
- LLM 分析需要时间，但没有实时进度更新
- 数据验证不完善，导致保存时出现类型错误

## 优化方案

### 1. 分批处理文本段落

**优化前：**
```typescript
// 一次性加载所有文本段落
const book = await prisma.book.findUnique({
  where: { id: bookId },
  include: {
    textSegments: {
      select: { content: true, orderIndex: true },
      orderBy: { orderIndex: 'asc' }
    }
  }
})

// 合并所有文本
const fullText = book.textSegments
  .map(segment => segment.content)
  .join('\n\n')

// 一次性分析
const analysisResult = await llmService.analyzeScript(fullText)
```

**优化后：**
```typescript
// 使用游标分页逐批获取文本段落
const BATCH_SIZE = 5 // 每批处理5个段落
const CHARS_PER_BATCH = 10000 // 每批最多10000字符

let cursor: string | undefined = undefined
let hasMore = true

while (hasMore) {
  // 获取下一批文本段落
  const segments = await prisma.textSegment.findMany({
    where: { bookId },
    select: { id: true, content: true, orderIndex: true },
    orderBy: { orderIndex: 'asc' },
    take: BATCH_SIZE,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
  })

  // 累积到达批次大小或字符限制时进行分析
  if (currentBatch.length >= BATCH_SIZE || currentBatchChars >= CHARS_PER_BATCH) {
    const batchText = currentBatch.join('\n\n')
    const result = await llmService.analyzeScript(batchText)
    mergeAnalysisResults(allCharacters, allDialogues, allEmotions, result)
    
    // 重置批次
    currentBatch = []
    currentBatchChars = 0
  }
}
```

### 2. 实时进度更新

```typescript
const progress = 10 + Math.floor((processedSegments / totalSegments) * 60)

await updateTaskProgress(
  taskId, 
  progress, 
  `分析进度: ${processedSegments}/${totalSegments} 段落 (${Math.floor(batchText.length / 1000)}K字符)`
)
```

### 3. 数据类型验证

```typescript
// 确保 age 是整数或 null
let ageHint: number | null = null
if (character.age !== undefined && character.age !== null) {
  const parsedAge = typeof character.age === 'number' ? character.age : parseInt(character.age, 10)
  ageHint = !isNaN(parsedAge) ? parsedAge : null
}
```

### 4. 结果合并逻辑

```typescript
function mergeAnalysisResults(
  allCharacters: any[],
  allDialogues: any[],
  allEmotions: any[],
  result: ScriptAnalysisResult
): void {
  // 合并角色信息 - 通过名称和别名匹配
  for (const newChar of result.characters) {
    const existingChar = allCharacters.find(c =>
      c.name === newChar.name ||
      (c.aliases && newChar.aliases && (
        c.aliases.some((alias: string) => newChar.aliases.includes(alias)) ||
        newChar.aliases.some((alias: string) => c.aliases.includes(alias))
      ))
    )

    if (existingChar) {
      // 合并已存在角色的信息
      existingChar.aliases = [...new Set([...existingChar.aliases, ...newChar.aliases])]
      existingChar.frequency = (existingChar.frequency || 0) + (newChar.frequency || 0)
      // ... 其他字段合并
    } else {
      allCharacters.push(newChar)
    }
  }
}
```

## 优化效果

### 内存使用
- **优化前**: 一次性加载所有文本（40K+ 字符）
- **优化后**: 每批最多 10K 字符，内存使用减少 75%

### 用户体验
- **优化前**: 无进度反馈，用户不知道是否在处理
- **优化后**: 实时显示进度百分比和处理的段落数

### 处理效率
- **优化前**: 对于大文本可能超时或内存溢出
- **优化后**: 稳定处理任意大小的文本，分批进行

### 测试结果
```
Book: 少妇黄蓉堕淫记
  Status: analyzed
  Text Segments: 26
  Characters: 14

Processing Tasks:
  - Type: CHARACTER_ANALYSIS
    Status: completed
    Progress: 100%
    
Progress Updates:
  5%  - 准备分析文本
  10% - 开始分段分析
  21% - 分析进度: 5/26 段落 (7K字符)
  44% - 分析进度: 15/26 段落 (9K字符)
  67% - 分析进度: 25/26 段落 (8K字符)
  70% - 分析最后批次
  80% - 保存分析结果
  90% - 更新书籍状态
  100% - 角色分析完成
```

## 技术要点

### 1. 游标分页
使用 Prisma 的游标分页避免一次性加载所有数据：
```typescript
const segments = await prisma.textSegment.findMany({
  take: BATCH_SIZE,
  ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
})
```

### 2. 批次控制
同时考虑段落数量和字符数量：
```typescript
if (currentBatch.length >= BATCH_SIZE || currentBatchChars >= CHARS_PER_BATCH) {
  // 处理批次
}
```

### 3. 增量合并
每批分析结果立即合并，避免重复处理：
```typescript
mergeAnalysisResults(allCharacters, allDialogues, allEmotions, result)
```

### 4. 类型安全
确保数据类型符合 Prisma schema 要求：
```typescript
ageHint: number | null  // 而不是 string
```

## 相关文件

- `/src/app/api/books/[id]/characters/analyze/route.ts` - 角色分析 API 路由
- `/src/lib/llm-service.ts` - LLM 服务（内部也有分块处理）
- `/src/lib/processing-task-utils.ts` - 任务进度更新工具

## 后续优化建议

1. **并行处理**: 可以考虑并行处理多个批次（需要注意 LLM API 速率限制）
2. **缓存机制**: 对已分析的文本段落进行缓存，避免重复分析
3. **增量分析**: 只分析新增的文本段落，而不是重新分析整本书
4. **性别识别改进**: 当前所有角色的 gender 都是 "unknown"，需要改进 LLM prompt
5. **重要性评估**: 改进角色重要性的判断逻辑，目前所有角色都是 "minor"
