// 一旦我被更新，请更新我的开头注释
// input: 路由层与执行器对 TTS 的调用
// output: 兼容导出的 TTS 类型、provider 与 manager
// pos: TTS 兼容入口
export type {
  TTSProvider,
  TTSRequest,
  TTSResponse,
  TTSVoice,
} from "@/lib/tts/types";

export { Qwen3VoiceTTSService } from "@/lib/tts/providers/qwen3voice";
export { TTSServiceManager, ttsServiceManager } from "@/lib/tts/service-manager";
