# 修复后快速启动指南

## 1. 应用数据库迁移

```bash
# 生成并应用新的数据库迁移（包含优化的索引）
npx prisma migrate dev --name add_performance_indexes

# 重新生成 Prisma Client
npx prisma generate
```

## 2. 环境变量配置

确保你的 `.env` 文件已正确配置（参考 `.env.example`）：

```bash
# 复制模板（如果还没有 .env 文件）
cp .env.example .env

# 编辑 .env 文件，填入真实的配置
nano .env
```

**重要配置项**:
- `DATABASE_URL` - PostgreSQL 连接字符串
- `REDIS_URL` - Redis 连接字符串
- `LLM_API_KEY` - LLM 服务 API 密钥
- `NEXTAUTH_SECRET` - 生成一个随机密钥

## 3. 启动应用

```bash
# 安装依赖（如果还没有）
npm install

# 启动开发服务器
npm run dev
```

## 4. 验证修复

### 4.1 测试速率限制

```bash
# 快速发送多个请求，第11次应该被限制
for i in {1..15}; do
  echo "Request $i:"
  curl -w "\nHTTP Status: %{http_code}\n" http://localhost:3000/api/books
  echo "---"
done
```

### 4.2 测试输入验证

```bash
# 测试空标题（应该返回 400 错误）
curl -X POST http://localhost:3000/api/books \
  -H "Content-Type: application/json" \
  -d '{"title": ""}' \
  | jq

# 测试有效输入（应该成功）
curl -X POST http://localhost:3000/api/books \
  -H "Content-Type: application/json" \
  -d '{"title": "测试书籍", "author": "测试作者"}' \
  | jq
```

### 4.3 测试文件上传安全性

```bash
# 创建一个测试文件
echo "测试内容" > test.txt

# 正常上传（应该成功）
curl -X POST http://localhost:3000/api/books/{book-id}/upload \
  -F "file=@test.txt"

# 测试路径遍历（应该被拒绝）
curl -X POST http://localhost:3000/api/books/{book-id}/upload \
  -F "file=@../../etc/passwd"
```

## 5. 新功能使用示例

### 5.1 使用结构化日志

```typescript
import { logger } from '@/lib/logger'

// 在你的代码中
logger.info('Processing book', { bookId, title })
logger.error('Failed to process', error, { bookId })
logger.warn('Slow query detected', { duration: 5000 })
```

### 5.2 使用缓存

```typescript
import { getCachedOrFetch } from '@/lib/cache'

const book = await getCachedOrFetch(
  `book:${bookId}`,
  () => prisma.book.findUnique({ where: { id: bookId } }),
  60000 // 1分钟缓存
)
```

### 5.3 使用验证

```typescript
import { CreateBookSchema } from '@/lib/validation'

const validatedData = CreateBookSchema.parse(body)
// validatedData 现在是类型安全的
```

### 5.4 使用速率限制

```typescript
import { withRateLimit } from '@/lib/rate-limiter'
import { withErrorHandler } from '@/lib/error-handler'

export const GET = withRateLimit(
  withErrorHandler(async (request) => {
    // 你的 API 逻辑
  }),
  {
    interval: 60000, // 1分钟
    maxRequests: 20, // 最多20次请求
  }
)
```

### 5.5 使用错误边界

```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary'

function MyPage() {
  return (
    <ErrorBoundary>
      <MyComponent />
    </ErrorBoundary>
  )
}
```

### 5.6 使用工具函数

```typescript
import { 
  validateBookExists,
  sanitizeFilename,
  parsePaginationParams,
  createPaginationResponse 
} from '@/lib/api-utils'

// 验证书籍存在
const book = await validateBookExists(bookId)

// 清理文件名
const safeName = sanitizeFilename(userInput)

// 解析分页
const { page, limit, skip } = parsePaginationParams(searchParams)

// 创建分页响应
return NextResponse.json({
  success: true,
  ...createPaginationResponse(items, total, page, limit)
})
```

## 6. 性能监控

查看日志输出，确认新的结构化日志正常工作：

```bash
# 查看应用日志
npm run dev

# 你应该看到类似这样的日志：
# [2024-11-11T10:00:00.000Z] [INFO] Books fetched {"count":10,"page":1,"limit":10}
# [2024-11-11T10:00:01.000Z] [INFO] Book created {"bookId":"xxx","title":"测试"}
```

## 7. 数据库性能检查

```sql
-- 检查新索引是否创建成功
SELECT 
  tablename, 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- 查看查询性能
EXPLAIN ANALYZE 
SELECT * FROM books 
WHERE status = 'completed' 
ORDER BY "createdAt" DESC 
LIMIT 10;
```

## 8. 常见问题

### Q: 数据库迁移失败怎么办？
```bash
# 重置数据库（警告：会删除所有数据）
npx prisma migrate reset

# 或者手动应用迁移
npx prisma migrate deploy
```

### Q: TypeScript 类型错误？
```bash
# 重新生成 Prisma Client
npx prisma generate

# 重启 TypeScript 服务器（VS Code）
# Cmd+Shift+P -> TypeScript: Restart TS Server
```

### Q: 速率限制太严格？
编辑 `src/lib/constants.ts`:
```typescript
RATE_LIMIT: {
  MAX_REQUESTS_PER_IP: 100, // 增加限制
}
```

### Q: 如何禁用速率限制（开发环境）？
在 API 路由中移除 `withRateLimit` 包装器：
```typescript
// 开发环境
export const GET = withErrorHandler(async (request) => {
  // ...
})

// 生产环境
export const GET = withRateLimit(withErrorHandler(async (request) => {
  // ...
}))
```

## 9. 下一步

1. ✅ 运行测试确保一切正常
2. ✅ 查看 `FIXES_APPLIED.md` 了解详细修复内容
3. ✅ 查看 `CODE_REVIEW.md` 了解原始问题
4. ✅ 逐步将其他 API 路由迁移到新模式
5. ✅ 添加单元测试

## 10. 需要帮助？

- 查看日志文件了解详细错误信息
- 检查 TypeScript 编译错误
- 确保所有环境变量已正确配置
- 验证数据库连接正常

祝你使用愉快！🎉
