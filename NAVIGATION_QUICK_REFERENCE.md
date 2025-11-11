# 导航系统快速参考

## 🎯 核心组件

### 1. `<Header />` - 全局导航
**位置**: `src/components/Navigation.tsx`  
**使用**: 已自动包含在 `src/app/layout.tsx` 中

```typescript
import { Header } from '@/components/Navigation'

// 在根布局中使用
<Header />
```

**功能**:
- Logo 和应用标题
- 主导航菜单（首页、我的书籍、语音库、角色管理）
- 自动高亮当前页面
- 响应式设计

---

### 2. `<BookNavigation />` - 书籍详情导航
**位置**: `src/components/BookNavigation.tsx`  
**使用**: 已自动包含在 `src/app/books/[id]/layout.tsx` 中

```typescript
import { BookNavigation } from '@/components/BookNavigation'

<BookNavigation 
  bookId={bookId}           // 必需
  bookTitle="书籍标题"       // 可选
  currentTab="segments"     // 可选，自动检测
/>
```

**功能**:
- 面包屑（返回列表 + 书籍标题）
- 6个标签页（概览、文本段落、角色配置、台本生成、音频生成、播放）
- 自动检测并高亮当前标签
- 横向滚动支持

---

## 📁 文件结构

```
src/
├── app/
│   ├── layout.tsx                    # 根布局（包含 Header）
│   ├── page.tsx                      # 首页
│   └── books/
│       └── [id]/
│           ├── layout.tsx            # 书籍布局（包含 BookNavigation）
│           ├── page.tsx              # 概览
│           ├── segments/page.tsx     # 文本段落
│           ├── characters/page.tsx   # 角色配置
│           ├── script/page.tsx       # 台本生成
│           ├── audio/page.tsx        # 音频生成
│           └── play/page.tsx         # 播放
└── components/
    ├── Navigation.tsx                # 全局导航
    ├── BookNavigation.tsx            # 书籍导航
    └── ErrorBoundary.tsx             # 错误边界
```

---

## 🚀 使用指南

### 创建新页面

#### 1. 顶级页面（使用全局导航）
```typescript
// src/app/my-page/page.tsx
export default function MyPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <h1>我的页面</h1>
      {/* 内容 */}
    </div>
  )
}
```
✅ 自动包含 Header  
✅ 无需添加导航代码

#### 2. 书籍子页面（使用书籍导航）
```typescript
// src/app/books/[id]/my-tab/page.tsx
export default function MyTabPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <h1>我的标签页</h1>
      {/* 内容 */}
    </div>
  )
}
```
✅ 自动包含 Header + BookNavigation  
✅ 无需添加导航代码

---

## 🎨 样式指南

### 页面容器

```typescript
// 全宽容器
<div className="container mx-auto px-4 py-6">

// 限制最大宽度
<div className="max-w-7xl mx-auto px-4 py-6">

// 书籍详情页推荐
<div className="max-w-7xl mx-auto">
```

### 背景色

```typescript
// 首页 - 渐变背景
className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"

// 详情页 - 灰色背景
className="bg-gray-50"

// 卡片 - 白色背景
className="bg-white"
```

---

## 🔗 路由映射

| 路径 | 标签页 | 组件 |
|------|--------|------|
| `/` | - | 首页 |
| `/books/[id]` | 概览 | BookDetailPage |
| `/books/[id]/segments` | 文本段落 | SegmentsPage |
| `/books/[id]/characters` | 角色配置 | CharactersPage |
| `/books/[id]/script` | 台本生成 | ScriptPage |
| `/books/[id]/audio` | 音频生成 | AudioPage |
| `/books/[id]/play` | 播放 | PlayPage |

---

## ⚡ 常见任务

### 添加新的全局导航项

编辑 `src/components/Navigation.tsx`:
```typescript
const navItems = [
  // ... 现有项
  {
    name: '新功能',
    href: '/new-feature',
    icon: NewIcon,
    disabled: false,  // 设为 true 禁用
  },
]
```

### 添加新的书籍标签页

编辑 `src/components/BookNavigation.tsx`:
```typescript
const bookTabs = [
  // ... 现有标签
  {
    id: 'new-tab',
    name: '新标签',
    href: '/new-tab',
    icon: NewIcon,
  },
]
```

然后创建页面:
```bash
# 创建新标签页
touch src/app/books/[id]/new-tab/page.tsx
```

### 自定义面包屑

```typescript
<BookNavigation 
  bookId={bookId}
  bookTitle="自定义标题"  // 覆盖默认标题
/>
```

### 程序化导航

```typescript
import { useRouter } from 'next/navigation'

const router = useRouter()

// 跳转到首页
router.push('/')

// 跳转到书籍详情
router.push(`/books/${bookId}`)

// 跳转到特定标签页
router.push(`/books/${bookId}/segments`)

// 返回上一页
router.back()
```

---

## 🐛 故障排除

### 导航不显示
✅ 检查是否在 `layout.tsx` 中包含了 `<Header />`  
✅ 检查导航组件是否正确导入

### 标签页不高亮
✅ 检查路由路径是否正确  
✅ 检查 `bookTabs` 中的 `href` 是否匹配

### 面包屑标题不显示
✅ 检查 API 是否正确返回书籍数据  
✅ 检查 `bookTitle` 状态是否正确设置

### 移动端导航不可见
✅ 检查是否有 `hidden md:flex` 类名  
✅ 考虑添加移动端菜单按钮

---

## 📝 最佳实践

### ✅ 推荐做法

1. **使用布局组件** - 让布局自动包含导航
2. **保持页面简洁** - 页面只关注内容，不处理导航
3. **使用标准容器** - 使用推荐的容器类名
4. **遵循路由约定** - 标签页 ID 与路由路径一致

### ❌ 避免做法

1. **不要重复添加导航** - 布局已包含
2. **不要硬编码返回逻辑** - 使用 BookNavigation
3. **不要自定义导航样式** - 保持一致性
4. **不要跳过布局** - 除非有特殊需求

---

## 🎯 检查清单

创建新页面时：
- [ ] 确定页面层级（顶级 or 书籍子页面）
- [ ] 使用正确的布局
- [ ] 使用推荐的容器类名
- [ ] 测试导航高亮
- [ ] 测试面包屑显示
- [ ] 测试移动端显示
- [ ] 检查路由是否正确

---

## 🔄 迁移现有页面

### 步骤 1: 移除旧导航
```typescript
// ❌ 删除这些
<header>...</header>
<Button onClick={() => router.back()}>返回</Button>
<nav>...</nav>
```

### 步骤 2: 简化容器
```typescript
// ❌ 之前
<div className="min-h-screen bg-gray-50">
  <header>...</header>
  <div className="container">
    {content}
  </div>
</div>

// ✅ 现在
<div className="max-w-7xl mx-auto">
  {content}
</div>
```

### 步骤 3: 测试
- 导航显示正常
- 高亮正确
- 返回功能正常

---

## 📞 需要帮助？

查看完整文档: `NAVIGATION_OPTIMIZATION.md`

Happy coding! 🚀
