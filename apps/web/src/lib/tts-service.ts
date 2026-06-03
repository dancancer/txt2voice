// 一旦我被更新，请更新我的开头注释
// input: 路由层与执行器对 TTS 的调用
// output: 兼容导出的 TTS 类型、VoxCPM2 provider 与 manager
// pos: TTS 兼容入口
export type {
  TTSProvider,
  TTSRequest,
  TTSResponse,
  TTSVoice,
} from "@/lib/tts/types";

export { VoxCPMTTSService } from "@/lib/tts/providers/voxcpm";
export { TTSServiceManager, ttsServiceManager } from "@/lib/tts/service-manager";
