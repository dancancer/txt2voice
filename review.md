# txt2voice 代码审查

## 关键问题
1. **角色识别覆盖式重建**（apps/web/src/app/api/books/[id]/characters/recognize/route.ts:408）
   - 每次识别都 deleteMany 整本书的角色，导致用户绑定（声音、说话人、旁白/默认角色）被清空，违背“角色信息合并”要求。
2. **角色识别/分析被状态卡住**（apps/web/src/app/api/books/[id]/characters/recognize/route.ts:33；apps/web/src/app/api/books/[id]/characters/analyze/route.ts:31）
   - 接口仅允许 `status === processed`（或 uploaded），脚本/音频阶段无法重新识别，实操流程被阻断。
3. **分析进度永远不可用**（apps/web/src/app/api/books/[id]/characters/analyze/route.ts:60 vs.115）
   - POST 创建 `CHARACTER_RECOGNITION` 任务，GET 却查询 `CHARACTER_ANALYSIS`，前端获取进度永远 `not_started`。
4. **增量台本只处理两个段落**（apps/web/src/lib/script-generator.ts:1151-1184）
   - `generatePartialScript` 将 `endIndex` 写死为 2，`limitToSegments` 被忽略，增量/续跑功能不可用。
5. **音频时长存储单位错误**（apps/web/src/lib/audio-generator.ts:433-444；apps/web/src/components/tts/AudioPreviewUpload.tsx:382-389）
   - 估算值以毫秒存进 Decimal 字段但展示为秒，导致 UI/统计夸大 1000 倍。
6. **音频生成无法在完成后重跑**（apps/web/src/app/api/books/[id]/audio/generate/route.ts:57 与 392）
   - 状态设置为 `completed` 后再触发生成会因 `status !== script_generated` 被拒，无法补录。
7. **TTS Provider 冷启动竞争**（apps/web/src/lib/tts-service.ts:418-500）
   - `ttsServiceManager` 构造时异步初始化，提早调用 `getVoice` 会拿到空 provider 导致“声音配置无效”。

## 改进计划
1. **角色识别持久化改造**
   - 调整 `saveRecognitionResults`：按 `canonicalName` 增量更新，保留已存在角色/别名/绑定；默认角色与人工绑定需要跳过删除。
   - 将 `character-recognition`/`analyze` 接口的状态验证放宽到 `processed/analyzed/script_generated/completed`，并仅以 `textSegments` 是否存在为硬条件。
   - 统一任务类型（全部使用 `CHARACTER_RECOGNITION` 或 `CHARACTER_ANALYSIS`），确保 GET 能反映真实进度。
2. **台本增量生成修复**
   - 恢复 `generatePartialScript` 的 endIndex 计算：`const endIndex = params.limitToSegments ? Math.min(...) : book.textSegments.length`。
   - 为 `/script/generate` 增量/限制流程补充单元或集成测试，防止回归。
3. **音频流水线稳定性提升**
   - 保存音频时用秒级真实时长（优先使用 TTS 返回值，无则估算后除以 1000）。
   - `POST /audio/generate` 允许 `script_generated | completed | generating_audio`，并在任务失败后恢复为 `script_generated`，保证补录链路。
   - 为 `ttsServiceManager` 增加同步机制（如 `await initPromise` 或 `ready()`），在 Provider/voice 列表准备好之前阻塞音频生成调用。
