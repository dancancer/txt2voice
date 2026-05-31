一旦我所属的文件夹有所变化，请更新我
架构: lib 层单元测试目录。
架构: 用于验证文本与脚本相关逻辑。

文件清单:
- audiobook-regression.test.ts | 地位: 单元测试 | 功能: 固定样本回归，校验章节/段落结构不回退
- README.md | 地位: 目录说明 | 功能: 记录目录职责与文件清单
- gbk-segmentation.test.ts | 地位: 单元测试 | 功能: 验证 gbk segmentation 相关逻辑
- script-sentence-contract.test.ts | 地位: 单元测试 | 功能: 验证 script/scripts 契约字段归一与弃用约束
- task-replay-route.test.ts | 地位: 接口测试 | 功能: 验证任务重放接口鉴权与成功路径
- voxcpm-provider.test.ts | 地位: 单元测试 | 功能: 验证 VoxCPM2 provider 映射、语气控制参数与音频下载
- tts-provider-status-route.test.ts | 地位: 接口测试 | 功能: 验证 TTS provider 轻量状态探测
- agent-runtime/* | 地位: 单元测试 | 功能: 验证 Mastra-only LLM workflow、runtime stage、compiler 与 bootstrap 逻辑
- smart-text-splitter.test.ts | 地位: 单元测试 | 功能: 验证 smart text splitter 相关逻辑
