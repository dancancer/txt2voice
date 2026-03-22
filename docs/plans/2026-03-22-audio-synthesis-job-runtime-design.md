# Audio Synthesis Job Runtime Design

**目标**

把音频生成从“父任务内部直接批量调用 TTS”改造成“父任务编排 + 句子级 TTS 子 job”，让单句合成具备统一的等待队列、共享并发池、自动重试、死信收敛和聚合指标。

## 背景

当前 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generation-runner.ts` 负责整批音频任务编排，但实际单句合成仍然埋在 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generator.ts` 的函数调用里：

- 单句：`generateSingleAudio()`
- 批量：`generateBatchAudioWithReliability()`
- 内部并发：`runBatchPass()` 里的 `Promise.allSettled()`

这导致问题很明显：

1. 单句合成没有进入统一 job 模型。
2. 并发控制是函数内批次，并不是系统共享池。
3. 重试粒度停留在“批次/函数逻辑”，不是“单句执行单元”。
4. 音频/TTS 这条链路和刚完成的 LLM job runtime 不一致。

## 设计原则

1. **单句合成是最小执行单元**：一个 `scriptSentenceId` 对应一个 TTS 子 job。
2. **父任务只做编排**：选择目标句子、提交子 job、聚合结果、做后置质检与合并。
3. **共享并发池**：所有 TTS 子 job 走同一条子队列，worker concurrency 统一控制。
4. **重试由 job options 驱动**：retryable 错误抛给队列，不在业务层写 while-loop。
5. **保留现有可靠性模型语义**：三阶段 pass-1/pass-2/pass-3 保留，但每次执行的是子 job 而不是本地函数。

## 核心架构

### 1. 父任务与子 job 分层

保留当前 `AUDIO_GENERATION` 的 `ProcessingTask` 作为父任务。

新增句子级子 job：

- queue: `audio-synthesis`
- payload: 单句请求 + 运行选项 + 来源元数据
- result: 单句音频生成结果 + 运行指标

父任务负责：

- `book/chapter/batch/single` 四类目标解析
- 提交子 job
- 等待每轮 pass 的子 job 完成
- 汇总成功/失败数
- 自动后置质检
- `autoMerge`
- 书籍状态更新

子 job 负责：

- 读取 `ScriptSentence`
- 路由选声
- 调用 TTS provider
- 写文件
- 写 `AudioFile` / `SynthesisAttempt`
- 返回结构化执行结果

### 2. 新增音频子队列

在现有 task queue 中新增：

- `AUDIO_SYNTHESIS_QUEUE_NAME`
- `AUDIO_SYNTHESIS_JOB_OPTIONS`
- `AUDIO_SYNTHESIS_MAX_CONCURRENCY`
- `getAudioSynthesisQueue()`
- `enqueueAudioSynthesisJob()`
- `runAudioSynthesisJob()`

这样现有 `AUDIO_GENERATION` queue 还是父任务 queue，不和子句子执行混在一起。

### 3. Audio Runtime

新增统一运行时：

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-synthesis-runtime.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-job-error.ts`

它负责：

- 入队音频子 job
- 等待 job finished
- 把最终失败的序列化错误恢复成 `TTSError`
- 补齐 queue wait / retriesUsed / totalElapsed 等执行指标

### 4. AudioGenerator 拆层

当前 `generateSingleAudio()` 既是对外 API，又是内部真正执行器。

改造后分成两层：

- `generateSingleAudio()`：对外统一走子 job runtime
- `executeAudioSynthesis()`：worker 内真正执行单句合成

这样不会递归入队。

### 5. 错误与重试边界

#### 应进入 job 重试

- TTS provider 连接失败
- API timeout
- provider 429 / 5xx
- `TTSError.retryable === true`

#### 不重试，直接返回失败结果

- `ScriptSentence` 不存在
- 没有可用声音配置
- `referenceAudio` / `speakerId` 等业务参数缺失
- 明确的 `TTS_SYNTHESIS_FAILED` 且 `retryable !== true`

结论：单句 job 对“暂时性失败”抛错，对“确定性失败”返回 `success:false`。

### 6. 保留现有可靠性三阶段

当前 `generateBatchAudioWithReliability()` 的 pass 模型保留：

- pass-1：全量
- pass-2：failed-only
- pass-3：rescue

区别是：

- 每个 pass 不再本地直接调用 `generateSingleAudio()`
- 而是批量提交句子级子 job，再等待结果

这样可以同时保留：

- 既有可靠性统计
- 共享并发池
- 子 job 粒度重试

### 7. 全局共享并发池

由 `AUDIO_SYNTHESIS_MAX_CONCURRENCY` 控制。

所有来源共享这一个池：

- 全书生成
- 章节生成
- 批量重生
- 单条重生
- `qc_retry`

超过并发上限的句子 job 自动进入 waiting。

### 8. 父任务聚合指标

父任务元数据新增：

- `audioChildJobMetrics.submitted`
- `audioChildJobMetrics.completed`
- `audioChildJobMetrics.failed`
- `audioChildJobMetrics.retried`
- `audioChildJobMetrics.averageWaitMs`
- `audioChildJobMetrics.averageLatencyMs`
- `audioChildJobMetrics.providers[]`

同时保留现有：

- `audioReliability`
- `routerDecisionSummary`
- `successCount/failedCount`

## 风险与权衡

### 风险 1：job 数量显著增加

一整本书可能对应几百到几千个子 job。

权衡：

- 这是正确的粒度
- Redis waiting 队列天然承接
- 并发上限由 worker 控制，不会把 provider 打爆

### 风险 2：同一条句子可能多次执行

比如三阶段 retry pass 会对失败句子再次提交新 job。

权衡：

- 这是显式的可靠性策略，不是重复 bug
- 每次 `AudioFile` / `SynthesisAttempt` 记录本来就允许多次尝试
- 最终由父任务按最新结果汇总

### 风险 3：父任务等待大量 `job.finished()`

等待数变大后，父任务内存中会持有更多 promise。

权衡：

- 当前先保持实现简单
- 如果后续大书场景成为瓶颈，再把等待收敛为分页/窗口批量提交

## 验收标准

1. 单句合成经由子 job 执行，而不是父任务内直接调 provider。
2. `book/chapter/batch/single` 都共享同一个 TTS 子队列。
3. retryable 失败会由子 job 自动重试。
4. 不可重试错误直接形成单句失败结果，不会白白重试。
5. 父任务仍保留现有 `audioReliability` 与后置质检行为。
