import type { QuotedSpan } from "./segment-script-validator-types";

export const DIALOGUE_OPENING_QUOTES = /^["“‘'「『]+/;
export const DIALOGUE_CLOSING_QUOTES = /["”’'」』]+$/;
export const MIN_COVERAGE_RATIO = 0.98;
export const TRAILING_SPEECH_PUNCTUATION = /[，。！？；：,.!?…]+$/;
export const SENTENCE_BOUNDARY_PATTERN = /[。！？；!?…]/g;
export const MAX_STRUCTURAL_ATTRIBUTION_FRAGMENT_LENGTH = 32;
export const MIN_SINGLE_QUOTE_BODY_RATIO = 0.35;
export const MIN_MULTI_QUOTE_BODY_RATIO = 0.3;
export const PUNCTUATION_ONLY_PATTERN = /^[\s，。！？；：,.!?…—-]+$/;
export const SHORT_REPLY_PATTERN =
  /^(?:嗯+|哦+|啊+|呀+|哎+|唉+|哈+|欸+|诶+|好+|行+|对|是|不|没|别|来|去|走|成|可|嗯嗯|好的|可以|不行|不要|不会|不是|知道|明白|当然|走吧|来吧|等等?|站住|闭嘴)$/;
export const DIALOGUE_QUOTE_PAIRS: Array<{ open: string; close: string }> = [
  { open: "“", close: "”" },
  { open: '"', close: '"' },
  { open: "「", close: "」" },
  { open: "『", close: "』" },
  { open: "‘", close: "’" },
  { open: "'", close: "'" },
];
export const DIALOGUE_QUOTE_CHAR_SET = new Set(
  DIALOGUE_QUOTE_PAIRS.flatMap(({ open, close }) => [open, close])
);
export const QUOTE_CHAR_PATTERN = /[“”「」『』‘’"']/;
export const GAP_QUOTE_CHAR_PATTERN = /[“”「」『』‘’"']/;
export const NARRATION_ACTION_CUE_PATTERN =
  /(心知|看出|解释|故作|接过|低头|望去|皱起|抬起头|点点头|翻出|抬手|扶额|转身|走去|看着|瞧见|沉下脸|伸手|起身|摇摇头|皱眉)/;
export const DANGLING_DIALOGUE_PUNCTUATION = /^[，、；：,:]+|[，、；：,:]+$/g;
export const AD_NOISE_LINK_PATTERN =
  /(https?:\/\/|www\.|[a-z0-9-]{2,}\.(?:com|cn|cc|net|xyz)\b|点(?:com|cn|cc|net))/i;
export const AD_NOISE_KEYWORDS = [
  "下载",
  "约炮",
  "平台",
  "直播",
  "同城交友",
  "纯原生",
  "app",
  "ＡＰＰ",
  "福利",
  "最新地址",
];
