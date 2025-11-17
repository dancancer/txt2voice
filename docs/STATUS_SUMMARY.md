# Text to Voice – 章节引入改造现状总结

最后更新：`2025-02-15`

## 1. 总览
- 书籍层级已扩展为"书籍 → 章节 → 段落"，所有关键数据表和 API 已接入章节信息。
- 脚本与音频任务可以按照书籍/章节/段落三种范围触发，台词与音频记录带有 `chapterId`。
- Web 端脚本页面改成树状导航（书籍→章节→段落）并支持在各层级执行台本/音频操作。
- **✅ 章节级音频拼接功能已实现**，支持章节和整书音频合并。
- 仍存在的 TypeScript 报错已全部修复。

## 2. 数据与后台状态
- **Prisma Schema**
  - 新增 `Chapter` 模型；`Book` 记录 `totalChapters`。
  - `TextSegment`、`ScriptSentence`、`AudioFile` 均新增 `chapterId` 及相关索引。
- **文本处理流程 (`text-processor.ts`)**
  - `createChapterSegmentRecords` 负责章节检测、章节内分段与统计。
  - `/api/books/[id]/process` 使用章节化分段结果，并在重新处理时清空 `chapters`。
- **API 覆盖**
  - `/api/books/[id]`、`/api/books/[id]/process`、`/api/books/[id]/segments`、`/api/books/[id]/scripts` 皆返回章节/段落树状所需数据，支持 `chapterId` 查询。
  - `/api/books/[id]/script/generate` 与 `/api/books/[id]/audio/generate` 支持 `type=chapter` 和 `chapterId` 参数，可按章节生成台本和音频。
  - **✅ 新增 `/api/books/[id]/audio/merge` 端点**，支持章节、整书和段落级别的音频合并。
  - 音频生成 API 新增 `autoMerge` 参数，可在生成完成后自动合并音频。
- **任务/状态**
  - `processing_tasks` 记录仍沿用原结构；计划中未新增新的 taskType，范围信息放在 `taskData`.

## 3. 前端现状（脚本页面）
- 左列为 `DocumentTree`：书籍节点 + 各章节/段落；节点显示台本/音频完成度。
- 中列根据选中节点展示：
  - **书籍**：整书台本卡片、角色指派、台词列表。
  - **章节**：章节详情卡片，可跳段落/批量操作。
  - **段落**：段落摘要 + 当前段落台词列表与单段落操作（重生成/生成音频）。
- 右列 `StatusSidebar` 保留状态概览与快捷入口。
- 新增的树状数据完全由 `DocumentTree.tsx` / `ChapterDetailPanel.tsx` 管理；`ScriptSentencesList` 支持自定义标题/空态文本。

## 4. 已知待办 / 风险
1. **✅ 音频拼接**：章节级音频合并功能已实现，使用 ffmpeg 进行音频拼接。
   - 实现了 `AudioMerger` 类（`src/lib/audio-merger.ts`）
   - 支持章节、整书和段落级别的音频合并
   - 新增 `/api/books/[id]/audio/merge` API 端点
   - 音频生成可选 `autoMerge` 参数自动合并
2. **API 性能**：脚本页一次性加载全部段落/台词，超大书籍可能产生延迟；需要未来引入分页或虚拟化。
3. **✅ TypeScript 报错**：所有类型错误已修复，包括 `tts/reference-audio/route.ts` 和 `SpeakerManagement.tsx`。
4. **任务监控**：`processing_tasks` 仍未带范围标签，可考虑在后续任务中补充便于前端展示。

## 5. 下一步建议
1. ✅ ~~后端实现章节音频拼接&下载，以及对应的任务状态回传。~~（已完成）
2. 对 `/segments` 和 `/scripts` API 增加分页/树状专用 endpoint，降低脚本页加载压力。
3. ✅ ~~梳理并修复现有 TypeScript 报错，以恢复 CI typecheck。~~（已完成）
4. ✅ ~~规划章节编辑/调整工具，允许手动划分或合并章节，丰富文案处理体验。~~（已完成，详见 `CHAPTER_EDITOR_DESIGN.md`）
5. ✅ ~~**前端集成**：在脚本页面添加"合并章节音频"和"合并整书音频"按钮，调用新的 merge API。~~（已完成）
6. ✅ ~~**Docker 支持**：确保 Docker 镜像包含 ffmpeg，用于音频合并功能。~~（已完成）

## 6. 最新实现（2025-02-15）

### 6.1 音频合并功能
**新增文件：**
- `src/lib/audio-merger.ts` - 音频合并工具类
  - `AudioMerger` 类提供章节、整书和段落级别的音频合并
  - 使用 ffmpeg 进行音频文件拼接
  - 支持自定义输出格式、比特率和静音间隔
  - 自动创建合并后的音频记录到数据库

**新增 API：**
- `POST /api/books/[id]/audio/merge` - 合并音频
  - 支持 `type`: `chapter`、`book`、`segment`
  - 返回合并后的文件信息（路径、大小、时长）
- `GET /api/books/[id]/audio/merge` - 获取已合并的音频列表
  - 可按类型筛选（章节、整书）
- `DELETE /api/books/[id]/audio/merge` - 删除合并的音频文件

**更新的功能：**
- `AudioGenerator.generateChapterAudio()` - 新增章节级音频生成方法
- 音频生成 API 支持 `type=chapter` 和 `autoMerge` 参数
- 生成完成后可自动调用合并功能

### 6.2 前端集成（2025-02-15）
**更新的组件：**
- `ChapterDetailPanel.tsx` - 章节详情面板
  - 新增"合并音频"按钮，可合并当前章节的所有音频
  - 按钮在章节有音频文件时启用
  - 使用 `Combine` 图标表示合并操作

- `ScriptGenerationCard.tsx` - 台本生成卡片
  - 新增"合并音频"按钮，可合并整本书的音频
  - 位于"整书音频"按钮旁边，使用次要样式
  - 在音频生成完成后可用

- `page.tsx` - 主脚本页面
  - 新增 `handleAudioMerge()` 函数处理音频合并请求
  - 支持整书和章节两个级别的音频合并
  - 显示合并进度和结果（文件名、大小）
  - 更新章节音频生成逻辑，支持 `type=chapter` 参数

**用户体验：**
- 用户在章节视图中点击"合并音频"按钮，系统自动合并该章节所有音频片段
- 用户在书籍视图中点击"合并音频"按钮，系统合并整本书的所有音频
- 合并成功后显示文件信息（文件名、大小）
- 合并的音频文件保存在 `uploads/audio/[bookId]/merged/` 目录

### 6.3 TypeScript 错误修复
修复了以下文件的类型错误：
1. `src/app/api/tts/reference-audio/route.ts`
   - 修正 `SpeakerProfile` 模型字段访问（使用 `id` 而非 `speakerId`）
   - 更新音频分析和说话人档案创建逻辑
2. `src/components/tts/SpeakerManagement.tsx`
   - 修正 `IndexTTSService` 方法调用（使用实例而非类静态方法）

**验证：** 所有 TypeScript 类型检查通过 ✅

### 6.4 Docker 配置（2025-02-15）
**更新的文件：**
- `apps/web/Dockerfile` - 生产环境 Docker 镜像
  - 在 runner stage（第45行）添加 `ffmpeg` 安装
  - 使用 `apk add --no-cache ffmpeg` 安装
  - 创建必要的音频和临时文件目录（第71-72行）
  - 确保目录权限正确设置（nextjs 用户）

- `apps/web/Dockerfile.dev` - 开发环境 Docker 镜像
  - 在基础镜像（第6-7行）添加 `ffmpeg` 安装
  - 确保开发环境也支持音频合并功能

**Docker 镜像优化：**
- 使用 Alpine Linux 的 `ffmpeg` 包，镜像体积增加约 50MB
- `--no-cache` 标志避免 APK 缓存，保持镜像精简
- 音频文件和临时文件目录通过 volumes 持久化
- 非 root 用户（nextjs）拥有上传目录的写权限

**验证命令：**
```bash
# 构建生产镜像
docker build -f apps/web/Dockerfile -t txt2voice-web .

# 验证 ffmpeg 安装
docker run --rm txt2voice-web ffmpeg -version

# 构建开发镜像
docker build -f apps/web/Dockerfile.dev -t txt2voice-web-dev .
```

**Docker Compose 支持：**
- `docker-compose.yml` 已配置 `uploads_data` volume
- 音频文件在容器重启后保持持久化
- 支持开发模式的热更新

**注意事项：**
- 生产镜像使用多阶段构建，ffmpeg 仅在 runner stage 安装
- 开发镜像直接在基础镜像安装 ffmpeg，支持热重载
- 两个镜像都确保 uploads 目录具有正确的权限

### 6.5 章节编辑工具规划（2025-02-15）
**完成内容：**
- 创建完整的功能设计文档：`docs/CHAPTER_EDITOR_DESIGN.md`
- 分析现有数据模型和架构
- 设计 8 大核心功能：
  1. 章节可视化编辑器（拖拽式界面）
  2. 章节拆分（将一个章节拆分为多个）
  3. 章节合并（合并多个章节）
  4. 章节重命名和重排序
  5. 段落重分配（在章节间移动段落）
  6. 章节删除与恢复
  7. 操作历史与撤销/重做
  8. 批量操作支持

**API 设计：**
- `GET/POST/PATCH/DELETE /api/books/{id}/chapters` - 基础 CRUD
- `POST /api/books/{id}/chapters/{id}/split` - 拆分章节
- `POST /api/books/{id}/chapters/merge` - 合并章节
- `POST /api/books/{id}/chapters/reorder` - 重排序章节
- `POST /api/books/{id}/segments/move` - 移动段落
- `GET /api/books/{id}/chapters/history` - 操作历史
- `POST /api/books/{id}/chapters/history/{id}/undo` - 撤销操作

**前端设计：**
- 双栏布局：左侧章节列表 + 右侧内容预览
- 7 个核心组件：
  - ChapterEditorPage（主页面）
  - ChapterListPanel（章节列表面板）
  - ChapterContentPanel（内容预览面板）
  - ChapterActionToolbar（操作工具栏）
  - ChapterSplitModal（拆分弹窗）
  - ChapterMergeModal（合并弹窗）
  - SegmentMoveModal（移动段落弹窗）
- 支持拖拽排序、多选操作、实时预览

**数据模型扩展：**
- 新增 `ChapterEditHistory` 表记录所有章节编辑操作
- 支持快照存储和操作回滚
- 维护数据一致性：章节、段落、台本、音频的级联更新

**技术要点：**
- 使用数据库事务保证原子性
- 批量操作优化性能
- 快照机制支持撤销/重做
- 级联更新关联数据（segments, scriptSentences, audioFiles）
- 自动重新索引 chapterIndex 和 chapterOrderIndex

**实施计划：**
- 第一阶段：基础功能（1-2周）- 数据模型、基础 API、主界面
- 第二阶段：高级操作（2-3周）- 拆分、合并、移动、重排序
- 第三阶段：历史与优化（1周）- 撤销/重做、性能优化、测试
- 第四阶段：打磨与发布（1周）- UI/UX 优化、错误处理、Beta 测试
- 总计：5-7周

**未来扩展：**
- AI 辅助章节划分（智能建议拆分点）
- 协作编辑（多人实时编辑）
- 版本管理（类似 Git 的分支和合并）
- 导入/导出章节结构

此文档可作为后续联调与任务规划的基线参考。欢迎在执行新任务前更新本摘要。***
