# Bug 修复：文本转义字符错误

## 🐛 问题描述

### 错误信息
```
Invalid `prisma.textSegment.createMany()` invocation:
unexpected end of hex escape at line 1 column 215
```

### 问题原因

当文本内容包含特殊控制字符（如 NULL 字符 `\0`、其他控制字符等）时，Prisma 在解析 JSON 数据时会将这些字符误解为转义序列，导致解析失败。

**具体场景**:
1. 用户上传的文本文件包含特殊字符
2. 文本处理后直接存入数据库
3. Prisma 尝试解析时遇到无效的转义序列
4. 抛出 "unexpected end of hex escape" 错误

---

## ✅ 解决方案

### 1. 在文本清理阶段移除问题字符

**文件**: `src/lib/text-processor.ts`

**修改**: `cleanText()` 函数

```typescript
export function cleanText(text: string, options: TextProcessingOptions = {}): string {
  const { preserveFormatting = true } = options

  let cleaned = text

  // 移除BOM标记
  cleaned = cleaned.replace(/^\uFEFF/, '')

  // ✅ 新增：移除 NULL 字符和其他控制字符
  cleaned = cleaned.replace(/\0/g, '')
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // ... 其他清理逻辑

  // ✅ 新增：规范化 Unicode
  cleaned = cleaned.normalize('NFC')

  return cleaned
}
```

### 2. 在创建数据库记录前再次清理

**文件**: `src/lib/text-processor.ts`

**新增**: `sanitizeContent()` 函数

```typescript
/**
 * 清理文本内容，移除可能导致数据库错误的特殊字符
 */
function sanitizeContent(content: string): string {
  return content
    // 移除 NULL 字符
    .replace(/\0/g, '')
    // 移除其他控制字符（保留换行、制表符）
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // 规范化 Unicode
    .normalize('NFC')
}
```

**修改**: `createTextSegmentRecords()` 函数

```typescript
export function createTextSegmentRecords(
  bookId: string,
  segments: TextSegmentData[]
): Prisma.TextSegmentCreateManyInput[] {
  let currentPosition = 0

  return segments.map((segment, index) => {
    // ✅ 清理内容，避免特殊字符导致数据库错误
    const sanitizedContent = sanitizeContent(segment.content)
    const startPosition = currentPosition
    const endPosition = currentPosition + sanitizedContent.length
    currentPosition = endPosition

    return {
      bookId,
      segmentIndex: index,
      startPosition,
      endPosition,
      content: sanitizedContent,  // ✅ 使用清理后的内容
      wordCount: segment.wordCount,
      segmentType: segment.type,
      orderIndex: segment.order,
      metadata: (segment.metadata || {}) as Prisma.InputJsonValue,
      status: 'pending'
    }
  })
}
```

---

## 🔍 清理的字符说明

### 移除的控制字符

| 范围 | 说明 | 保留 |
|------|------|------|
| `\x00` | NULL 字符 | ❌ 移除 |
| `\x01-\x08` | 其他控制字符 | ❌ 移除 |
| `\x09` | 制表符 (Tab) | ✅ 保留 |
| `\x0A` | 换行符 (LF) | ✅ 保留 |
| `\x0B` | 垂直制表符 | ❌ 移除 |
| `\x0C` | 换页符 | ❌ 移除 |
| `\x0D` | 回车符 (CR) | ✅ 保留（后续转换为 LF） |
| `\x0E-\x1F` | 其他控制字符 | ❌ 移除 |
| `\x7F` | DEL 字符 | ❌ 移除 |

### Unicode 规范化

使用 `normalize('NFC')` 将 Unicode 字符规范化为标准形式：
- **NFC**: Normalization Form Canonical Composition
- 将组合字符转换为预组合字符
- 确保相同字符的一致性表示

**示例**:
```typescript
// 组合字符
'é' (e + ́) 
// 规范化后
'é' (单个字符)
```

---

## 📊 影响范围

### 修改的文件
1. ✅ `src/lib/text-processor.ts`
   - `cleanText()` - 添加控制字符清理
   - `sanitizeContent()` - 新增清理函数
   - `createTextSegmentRecords()` - 使用清理后的内容

### 影响的功能
1. ✅ 文件上传处理
2. ✅ 文本分割
3. ✅ 数据库存储

### 向后兼容性
- ✅ 完全向后兼容
- ✅ 不影响现有数据
- ✅ 不改变 API 接口

---

## 🧪 测试建议

### 1. 测试包含特殊字符的文件

```typescript
// 创建测试文件
const testContent = `
正常文本内容
\x00包含NULL字符的文本
\x01包含控制字符的文本
正常文本继续
`

// 测试清理
const cleaned = cleanText(testContent)
console.log(cleaned) // 应该移除所有控制字符
```

### 2. 测试数据库存储

```bash
# 1. 上传包含特殊字符的文本文件
# 2. 处理文件
# 3. 验证数据库中的内容正确
# 4. 确认没有转义错误
```

### 3. 测试 Unicode 字符

```typescript
// 测试 Unicode 规范化
const text1 = 'é' // 组合字符
const text2 = 'é' // 预组合字符

const cleaned1 = cleanText(text1)
const cleaned2 = cleanText(text2)

console.log(cleaned1 === cleaned2) // 应该为 true
```

---

## 🚀 部署步骤

### 1. 重启开发服务器

```bash
# 停止当前服务器
Ctrl + C

# 重新启动
npm run dev
```

### 2. 测试修复

```bash
# 1. 上传之前失败的文件
# 2. 处理文件
# 3. 验证成功
```

### 3. 清理旧数据（可选）

如果之前有失败的处理记录：

```bash
# 使用 DELETE API 清理
DELETE /api/books/{bookId}/process

# 然后重新处理
POST /api/books/{bookId}/process
```

---

## 📝 预防措施

### 1. 文件上传验证

在 `src/app/api/books/[id]/upload/route.ts` 中添加内容验证：

```typescript
// 验证文件内容
const content = buffer.toString('utf-8')

// 检查是否包含过多控制字符
const controlCharCount = (content.match(/[\x00-\x1F\x7F]/g) || []).length
const totalChars = content.length

if (controlCharCount / totalChars > 0.1) {
  throw new ValidationError('文件包含过多无效字符，可能已损坏')
}
```

### 2. 日志记录

添加日志记录清理的字符数：

```typescript
function sanitizeContent(content: string): string {
  const originalLength = content.length
  
  const cleaned = content
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .normalize('NFC')
  
  const removedCount = originalLength - cleaned.length
  
  if (removedCount > 0) {
    logger.debug('Removed control characters', {
      originalLength,
      cleanedLength: cleaned.length,
      removedCount,
    })
  }
  
  return cleaned
}
```

### 3. 错误监控

在错误处理中添加特殊字符检测：

```typescript
catch (error) {
  if (error.message.includes('hex escape')) {
    logger.error('Text contains invalid escape sequences', {
      bookId,
      error: error.message,
    })
    
    throw new FileProcessingError(
      '文本包含无效字符，请检查文件编码',
      'INVALID_CHARACTERS',
      { originalError: error.message }
    )
  }
  
  throw error
}
```

---

## 🎯 最佳实践

### ✅ 推荐

1. **总是清理用户输入** - 不信任任何外部数据
2. **多层防护** - 在多个阶段清理数据
3. **规范化 Unicode** - 确保字符一致性
4. **记录清理操作** - 便于调试和监控
5. **验证文件质量** - 拒绝明显损坏的文件

### ❌ 避免

1. **直接存储原始内容** - 可能包含危险字符
2. **忽略编码问题** - 导致乱码或错误
3. **过度清理** - 移除有效的特殊字符
4. **静默失败** - 应该记录清理操作
5. **缺少验证** - 应该验证清理效果

---

## 📚 相关资源

### Unicode 规范化
- [Unicode Normalization Forms](https://unicode.org/reports/tr15/)
- [JavaScript String.normalize()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize)

### 控制字符
- [ASCII Control Characters](https://en.wikipedia.org/wiki/Control_character)
- [C0 and C1 control codes](https://en.wikipedia.org/wiki/C0_and_C1_control_codes)

### Prisma 相关
- [Prisma JSON Fields](https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields)
- [Prisma Error Reference](https://www.prisma.io/docs/reference/api-reference/error-reference)

---

## 🎊 总结

通过添加文本清理和字符规范化，我们解决了：

1. ✅ **Prisma 转义错误** - 移除无效的控制字符
2. ✅ **数据一致性** - Unicode 规范化
3. ✅ **多层防护** - 在多个阶段清理
4. ✅ **向后兼容** - 不影响现有功能
5. ✅ **预防性措施** - 防止未来出现类似问题

**现在可以安全地处理包含特殊字符的文本文件了！** 🚀

---

**修复时间**: 2024-11-11  
**修复人员**: AI Assistant  
**影响范围**: 文本处理模块
