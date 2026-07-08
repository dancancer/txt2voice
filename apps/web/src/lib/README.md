一旦我所属的文件夹有所变化，请更新我
架构: 业务与基础能力库。
架构: 供 API 与页面层共享复用。

文件清单:
- README.md | 地位: 目录说明 | 功能: 记录目录职责与文件清单
- agent-runtime | 地位: 领域目录 | 功能: 提供 LLM workflow 定义加载、runtime stage 执行、script-production 真相源与相关测试
- api-utils.ts | 地位: 功能模块 | 功能: 提供 api utils 相关能力
- api.ts | 地位: 功能模块 | 功能: 提供 api 相关能力
- audio-generation-runner.ts | 地位: 功能模块 | 功能: 提供音频任务执行 runner
- audio-generator.ts | 地位: 功能模块 | 功能: 提供 audio generator 相关能力
- audio-merger.ts | 地位: 功能模块 | 功能: 提供 audio merger 相关能力
- audio-utils.ts | 地位: 功能模块 | 功能: 提供 audio utils 相关能力
- book-api.ts | 地位: 功能模块 | 功能: 提供 book api 相关能力
- cache.ts | 地位: 功能模块 | 功能: 提供 cache 相关能力
- cosyvoice-service.ts | 地位: 功能模块 | 功能: 提供 cosyvoice service 相关能力
- constants.ts | 地位: 功能模块 | 功能: 提供 constants 相关能力
- error-handler.ts | 地位: 功能模块 | 功能: 提供 error handler 相关能力
- indextts-service.ts | 地位: 功能模块 | 功能: 提供 indextts service 相关能力
- llm | 地位: 领域目录 | 功能: 提供 LLM provider 解析、客户端调用与执行事件定义
- logger.ts | 地位: 功能模块 | 功能: 提供 logger 相关能力
- manual-review-service.ts | 地位: 功能模块 | 功能: 提供人工复核查询、保存修订与重跑编排
- pagination.ts | 地位: 功能模块 | 功能: 提供 pagination 相关能力
- prisma.ts | 地位: 功能模块 | 功能: 提供 prisma 相关能力
- processing-task-utils.ts | 地位: 功能模块 | 功能: 提供 processing task utils 相关能力
- rate-limiter.ts | 地位: 功能模块 | 功能: 提供 rate limiter 相关能力
- redis.ts | 地位: 功能模块 | 功能: 提供 redis 相关能力
- script-generation-runner.ts | 地位: 功能模块 | 功能: 提供台本任务执行 runner
- script-sentence-contract.ts | 地位: 功能模块 | 功能: 提供 script/scripts 协议归一与查询/更新参数校验
- script-sentence-service.ts | 地位: 功能模块 | 功能: 提供台词 CRUD 与排序服务
- simple-test.js | 地位: 测试脚本 | 功能: 用于 simple test 相关调试与验证
- smart-text-splitter.ts | 地位: 功能模块 | 功能: 提供 smart text splitter 相关能力
- status.ts | 地位: 功能模块 | 功能: 提供 status 相关能力
- test-debug.ts | 地位: 功能模块 | 功能: 提供 test debug 相关能力
- test-with-real-file.js | 地位: 测试脚本 | 功能: 用于 test with real file 相关调试与验证
- text-processor.ts | 地位: 功能模块 | 功能: 提供 text processor 相关能力
- task-queue.ts | 地位: 功能模块 | 功能: 提供队列执行、心跳恢复、重放能力
- task-replay-auth.ts | 地位: 功能模块 | 功能: 提供任务重放鉴权能力
- tts-service.ts | 地位: 功能模块 | 功能: 提供 tts service 相关能力
- tts | 地位: 领域目录 | 功能: 提供统一 TTS provider manager、共享类型与 provider 实现
- types.ts | 地位: 类型定义 | 功能: 定义本目录共享类型
- utils.ts | 地位: 功能模块 | 功能: 提供 utils 相关能力
- validation.ts | 地位: 功能模块 | 功能: 提供 validation 相关能力
- voxcpm-service.ts | 地位: 功能模块 | 功能: 提供 voxcpm service 相关能力
