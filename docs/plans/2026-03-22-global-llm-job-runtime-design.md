# Global LLM Job Runtime Design

**目标**

把系统内所有 LLM 调用统一改造成 Bull job，通过 Redis 队列提供全局共享的并发池、等待队列、失败重试和死信处理；后续新增的异步能力也沿用同一套 job 运行模型，避免每种能力都各写一套重试和限流逻辑。

## 背景

当前 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/llm-service.ts` 直接发起 LLM HTTP 请求。这样有三个问题：

1. 失败重试策略分散，且没有统一入口。
2. 并发控制只存在于上层业务循环里，无法做到系统级共享。
3. 如果后续把更多异步能力接入系统，会继续复制一套新的调度、限流、重试代码。

现有音频、质检、自动编排已经在走 Bull 队列；LLM 仍然停留在“同步函数内部直接出网”的模式，架构不一致。

## 设计原则

1. **统一入口**：所有 LLM 请求都必须先进入同一条 LLM 队列。
2. **全局共享**：并发上限由单一配置控制，跨任务、跨页面、跨 worker 共享。
3. **等待优于拒绝**：超过并发上限的请求进入 waiting 队列，而不是在业务层抛错。
4. **把副作用留在边界**：LLM 推理可以并发；数据库写入和共享状态合并保持可控、有序。
5. **避免任务爆炸**：单次 LLM 调用是 job，但不额外创建海量 `ProcessingTask` 行；父任务负责聚合统计。

## 目标范围

本轮设计覆盖：

- 所有经由 `LLMService.callLLM()` 进入的调用
- LLM 调用失败的统一自动重试
- 基于 Bull worker concurrency 的全局并发池
- 无前后依赖的调用点并行提交
- 脚本生成链路的“并行推理 + 有序落库”

本轮不做：

- 为每个 LLM 子调用生成独立任务中心记录
- 改写任务中心 UI 展示所有 LLM 子 job
- 把所有现有异步家族抽成一个完全通用的框架层

## 核心架构

### 1. 新增 LLM 专用队列

在现有 task queue 基础设施内新增一组 LLM 队列定义：

- `LLM_QUEUE_NAME`
- `LLM_JOB_OPTIONS`
- `getLLMQueue()`
- `enqueueLLMExecutionJob()`
- LLM worker `process(LLM_MAX_CONCURRENCY, ...)`

队列 payload 至少包含：

- provider 配置快照
- model
- prompt / systemPrompt
- 请求来源元数据（bookId、taskId、segmentId、callSite）
- 请求超时与调试开关

队列 result 至少包含：

- content
- model
- usage
- latencyMs
- attempt

### 2. 统一 LLM Runtime

新增 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/llm-runtime.ts` 作为唯一的 LLM 执行边界。

它负责：

- 创建 LLM job
- 等待 `job.finished()`
- 统一识别 retryable 错误
- 在 worker 侧真正调用 OpenAI 兼容接口
- 汇总返回值与失败元数据

`LLMService` 不再直接访问 OpenAI SDK 进行业务调用，而是拆成两层：

- 对外：`callLLM()` -> 走 LLM runtime job
- 对内：`executeProviderCall()` -> 只给 LLM worker 使用

这样系统里不会再出现多个“直接发 LLM 请求”的入口。

### 3. 全局共享并发池

并发池不再靠进程内 semaphore，而是直接利用 Bull worker 的全局队列语义。

- 同一条 Redis 队列天然就是共享等待队列
- `LLM_MAX_CONCURRENCY` 决定同时 active 的 job 数
- 超出的请求进入 waiting
- 多个父任务同时提交请求时，自动共享一个池

建议配置：

- `LLM_MAX_CONCURRENCY=8`
- `LLM_JOB_MAX_ATTEMPTS=3`
- `LLM_JOB_BACKOFF_DELAY_MS=1000`
- `LLM_JOB_TIMEOUT_MS=120000`

### 4. 统一失败重试

所有 LLM 调用失败重试都交给 LLM job options，而不是在业务代码里手写 while-loop。

重试范围：

- 网络连接失败
- 超时
- OpenAI 兼容 API 429
- 5xx
- 当前语义上可恢复的 provider 异常

不重试：

- 鉴权失败
- 明确的 4xx 参数错误
- 业务侧已判定不可恢复的语义错误

这样“是否要重试”由错误分类决定，而不是靠文案匹配。

### 5. 脚本生成改成两阶段

当前 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/pipeline/segment-processor.ts` 把三件事绑在一起：

1. 调 LLM
2. 解析/修复/校验
3. 更新角色映射并落库

这导致上层只能串行。

改造后分成两阶段：

#### 阶段 A：并行推理

对每个 segment 提交 LLM job，得到内存中的 `SegmentProcessingResult` 或失败详情。

这一阶段只做：

- prompt 构造
- LLM 请求
- JSON 解析与修复
- 句子校验
- 返回结构化结果

不做：

- `CharacterProfile` 写入
- `ScriptSentence` 写入
- 共享 `characterMap` 的在线变更

#### 阶段 B：有序合并与落库

按原始 segment 顺序串行执行：

- 合并角色候选
- 更新运行中的 character map
- `saveSegmentScriptToDatabase()`
- 记录失败段与复核项

这样并发只发生在纯推理阶段，副作用仍保持可预测顺序。

### 6. 依赖判断

“没有前后依赖则并行”在本设计中的判断口径如下：

- 单次 LLM 请求与其他请求没有共享可变状态：可并行提交
- 请求结果会影响后续 prompt 或共享写入顺序：保留串行合并

因此：

- 脚本生成的 segment LLM 推理可以并行
- 脚本生成的角色映射合并和 DB 落库仍按顺序
- `analyzeScript()` 的 continuation chunk 仍保持串行，因为 prompt 明确依赖前文语义

## 可观测性

每个 LLM 子 job 不额外创建 `ProcessingTask`，但会把统计回写到父任务元数据：

- llmSubmitted
- llmCompleted
- llmFailed
- llmRetried
- llmQueueWaitMs
- llmLatencyMs

失败耗尽重试后写入 dead-letter queue，便于后续排查。

## 与未来异步能力的统一

本次不是只给 LLM 打补丁，而是明确一个统一约定：

1. 异步能力必须有专属 Bull queue
2. 失败重试必须走 job options
3. 并发控制必须由 worker concurrency 或等价共享资源控制
4. 父任务负责聚合子 job 指标，避免海量子任务污染任务中心

音频生成已经基本符合这套模型；后续新能力直接复用这一约定即可。

## 风险与权衡

### 风险 1：并行推理降低同次运行内的角色增量感知

因为 segment 推理阶段使用的是调度时的角色快照，晚到的 segment 看不到同批次早到 segment 刚识别出的新角色。

权衡：

- 这是质量与吞吐的明确交换
- 结果仍会在落库阶段自动补建角色
- 如果后续证明影响明显，可升级成“分波次并行”，而不是回退到全串行

### 风险 2：父任务一次提交大量 LLM job

如果整本书很大，父任务可能瞬间向队列提交很多 job。

权衡：

- Bull waiting 队列天然承接
- 全局并发上限控制 active job 数
- 如提交压力过大，可后续补本地批量 dispatch 窗口，但本轮先不引入额外复杂度

### 风险 3：测试环境没有 Redis

为了让单测可控，需要提供可切换的 inline executor。

设计上允许：

- 生产默认 queue 模式
- 测试显式 mock runtime 或启用 inline 模式

## 验收标准

1. 所有现有 LLM 调用都经过统一 runtime。
2. 同时发起多个独立 LLM 请求时，active 数不会超过 `LLM_MAX_CONCURRENCY`。
3. retryable 错误会自动重试，超过上限后进入 dead-letter。
4. 脚本生成可并行提交 segment LLM 推理，但最终写库顺序稳定。
5. 父任务元数据能看到 LLM 子 job 的聚合统计。
