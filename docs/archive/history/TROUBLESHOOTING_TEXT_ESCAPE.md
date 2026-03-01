# 故障排除：文本转义字符错误

## 🔍 问题现象

```
Invalid `prisma.textSegment.createMany()` invocation:
unexpected end of hex escape at line 1 column 215
```

## ✅ 已实施的修复

### 1. 文本清理函数更新

**文件**: `src/lib/text-processor.ts`

已添加以下清理逻辑：

```typescript
// cleanText() 函数
- 移除 NULL 字符 (\0)
- 移除控制字符 ([\x00-\x08\x0B\x0C\x0E-\x1F\x7F])
- 保留换行符、制表符
- Unicode 规范化 (NFC)

// sanitizeContent() 函数
- 双重清理保护
- 详细日志记录
```

## 🚀 故障排除步骤

### 步骤 1: 清理 Next.js 缓存

```bash
# 停止开发服务器
Ctrl + C

# 删除缓存
rm -rf .next

# 重新启动
npm run dev
```

### 步骤 2: 检查文件内容

如果问题仍然存在，检查上传的文件：

```bash
# 查看文件的十六进制内容
hexdump -C /path/to/uploaded/file.txt | head -50

# 查找特殊字符
cat /path/to/uploaded/file.txt | od -c | grep '\\0'
```

### 步骤 3: 清理数据库中的旧数据

```bash
# 使用 API 清理
curl -X DELETE http://localhost:3000/api/books/{bookId}/process

# 或者直接在数据库中删除
# psql -d txt2voice -c "DELETE FROM \"TextSegment\" WHERE \"bookId\" = 'xxx';"
```

### 步骤 4: 重新上传和处理

1. 删除旧的书籍记录
2. 重新上传文件
3. 重新处理文件

## 🔧 手动测试清理函数

运行测试脚本：

```bash
node test-sanitize.js
```

应该看到：

```
✅ NULL字符
✅ 控制字符
✅ 保留换行和制表符
✅ DEL字符
✅ 混合特殊字符
✅ Unicode规范化

总计: 6 个测试
通过: 6
失败: 0
```

## 📊 检查日志

查看日志中的清理信息：

```bash
# 查看开发服务器日志
# 应该看到类似的输出：

[DEBUG] Sanitized content {
  originalLength: 1234,
  cleanedLength: 1230,
  removedCount: 4,
  preview: "这是一段包含特殊字符的文本..."
}
```

## 🐛 如果问题仍然存在

### 可能的原因

1. **缓存未清理**
   - 解决：删除 `.next` 目录并重启

2. **文件编码问题**
   - 检查：文件是否使用正确的编码（UTF-8）
   - 解决：使用文本编辑器重新保存为 UTF-8

3. **数据库中已有损坏数据**
   - 检查：查询数据库中的 TextSegment 表
   - 解决：删除相关记录

4. **Prisma 客户端未更新**
   - 解决：重新生成 Prisma 客户端
   ```bash
   npx prisma generate
   ```

### 调试步骤

#### 1. 添加更多日志

在 `src/app/api/books/[id]/process/route.ts` 中添加：

```typescript
// 在 createMany 之前
logger.info('Creating segments', {
  count: segmentRecords.length,
  firstSegmentPreview: segmentRecords[0]?.content.slice(0, 50),
  firstSegmentLength: segmentRecords[0]?.content.length,
})

// 检查是否有特殊字符
segmentRecords.forEach((record, index) => {
  const hasSpecialChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(record.content)
  if (hasSpecialChars) {
    logger.warn('Segment contains special characters', {
      index,
      preview: record.content.slice(0, 50),
    })
  }
})
```

#### 2. 逐个插入段落

如果批量插入失败，尝试逐个插入找出问题段落：

```typescript
// 替换 createMany
for (const record of segmentRecords) {
  try {
    await tx.textSegment.create({
      data: record
    })
  } catch (error) {
    logger.error('Failed to create segment', {
      record: {
        ...record,
        content: record.content.slice(0, 100) + '...'
      },
      error: error.message
    })
    throw error
  }
}
```

#### 3. 检查特定字符

创建检测脚本：

```javascript
// check-content.js
const fs = require('fs')

const filePath = process.argv[2]
if (!filePath) {
  console.log('Usage: node check-content.js <file-path>')
  process.exit(1)
}

const content = fs.readFileSync(filePath, 'utf-8')

// 检查特殊字符
const specialChars = content.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g)

if (specialChars) {
  console.log('Found special characters:')
  specialChars.forEach((char, index) => {
    const charCode = char.charCodeAt(0)
    const position = content.indexOf(char)
    console.log(`  ${index + 1}. Code: 0x${charCode.toString(16).padStart(2, '0')} at position ${position}`)
  })
  console.log(`\nTotal: ${specialChars.length} special characters`)
} else {
  console.log('No special characters found')
}

// 检查文件编码
console.log('\nFile info:')
console.log(`  Size: ${content.length} characters`)
console.log(`  Lines: ${content.split('\n').length}`)
```

运行：
```bash
node check-content.js /path/to/uploaded/file.txt
```

## 📝 预防措施

### 1. 文件上传时验证

在 `src/app/api/books/[id]/upload/route.ts` 中：

```typescript
// 验证文件内容
const content = buffer.toString('utf-8')

// 检查特殊字符比例
const specialCharCount = (content.match(/[\x00-\x1F\x7F]/g) || []).length
const totalChars = content.length

if (specialCharCount / totalChars > 0.01) { // 超过1%
  logger.warn('File contains many special characters', {
    specialCharCount,
    totalChars,
    ratio: (specialCharCount / totalChars * 100).toFixed(2) + '%'
  })
}

// 如果特殊字符过多，拒绝文件
if (specialCharCount / totalChars > 0.1) { // 超过10%
  throw new ValidationError('文件包含过多无效字符，可能已损坏')
}
```

### 2. 添加健康检查

创建 API 端点检查文本质量：

```typescript
// GET /api/books/[id]/validate
export const GET = withErrorHandler(async (request, { params }) => {
  const { id: bookId } = await params
  
  const book = await prisma.book.findUnique({
    where: { id: bookId }
  })
  
  if (!book?.uploadedFilePath) {
    throw new ValidationError('文件不存在')
  }
  
  const content = await readFile(book.uploadedFilePath, 'utf-8')
  
  // 检查文件质量
  const stats = {
    totalChars: content.length,
    lines: content.split('\n').length,
    specialChars: (content.match(/[\x00-\x1F\x7F]/g) || []).length,
    nullChars: (content.match(/\0/g) || []).length,
    encoding: book.encoding,
  }
  
  stats.quality = stats.specialChars / stats.totalChars < 0.01 ? 'good' : 'poor'
  
  return NextResponse.json({
    success: true,
    data: stats
  })
})
```

## 🎯 最终检查清单

在处理文件前：

- [ ] 服务器已重启（清理缓存）
- [ ] 文件编码正确（UTF-8）
- [ ] 文件内容可读（无乱码）
- [ ] 旧数据已清理
- [ ] 日志级别设置正确

处理文件时：

- [ ] 查看日志输出
- [ ] 检查清理统计
- [ ] 验证段落数量
- [ ] 确认没有错误

处理完成后：

- [ ] 检查数据库记录
- [ ] 验证内容完整性
- [ ] 测试后续流程

## 📞 获取帮助

如果以上步骤都无法解决问题：

1. 收集以下信息：
   - 错误日志（完整堆栈）
   - 文件样本（前100行）
   - 数据库查询结果
   - 环境信息（Node版本、Prisma版本）

2. 检查文件：
   ```bash
   # 导出问题文件的十六进制
   hexdump -C problem-file.txt > hexdump.txt
   
   # 检查数据库
   psql -d txt2voice -c "SELECT id, \"bookId\", length(content), substring(content, 1, 50) FROM \"TextSegment\" LIMIT 10;"
   ```

3. 查看相关文档：
   - `BUGFIX_TEXT_ESCAPE.md` - 详细修复文档
   - `TEXT_SPLITTING_OPTIMIZATION.md` - 文本分割优化
   - Prisma 错误参考文档

---

**更新时间**: 2024-11-11  
**维护人员**: AI Assistant
