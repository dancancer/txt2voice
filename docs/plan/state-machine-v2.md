# 书籍状态机 v2（LLM-only）

> 更新日期：2026-03-01
> 
> 目标：移除历史阶段回退（`analyzing/analyzed`），统一主流程状态语义，并支持“部分完成”。

## 状态定义

- `uploaded`：文件已上传，未做文本处理
- `processing`：文本处理中
- `processed`：文本已切段，可开始台本生成
- `generating_script`：台本生成中
- `script_generated`：台本生成成功且完整
- `generating_audio`：音频生成中
- `completed`：音频生成全量成功
- `completed_with_errors`：音频生成已结束，但存在失败句子
- `error`：系统级异常（保留）

## 主链路流转

`uploaded -> processing -> processed -> generating_script -> script_generated -> generating_audio -> completed | completed_with_errors`

## 失败与回退规则

### 台本阶段

- 任一段落生成失败（含“返回空台词”）时：
  - `ProcessingTask(SCRIPT_GENERATION).status = failed`
  - 书籍状态回退到 `processed`
  - `book.metadata` 记录失败段 ID 与失败数量
- 台本清除（DELETE /script/generate）后：
  - 书籍状态置回 `processed`

### 音频阶段

- 全量失败（成功数=0）：
  - `ProcessingTask(AUDIO_GENERATION).status = failed`
  - 书籍状态回退到 `script_generated`
- 部分失败（成功数>0 且失败数>0）：
  - `ProcessingTask(AUDIO_GENERATION).status = completed`
  - 书籍状态置为 `completed_with_errors`
- 全量成功：
  - 书籍状态置为 `completed`

## 兼容策略

- 旧状态 `analyzing/analyzed` 仍可被 UI 标签识别（只读兼容），但不再作为新流转目标。
