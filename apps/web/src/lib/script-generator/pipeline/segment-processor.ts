import { TTSError } from "@/lib/error-handler";
import {
  DIALOGUE_CLOSING_QUOTE_CHARS,
  DIALOGUE_QUOTE_PAIRS,
  updateDialogueQuoteStack,
} from "@/lib/dialogue-quote-tracker";
import {
  addCharacterToMap,
  normalizeCharacterCandidates,
  resolveCandidateCanonicalName,
  upsertCharacterCandidates,
} from "../storage/character-utils";
import { parseLLMJsonResult } from "./json-utils";
import {
  refineFailedSegment,
  shouldRefineSegmentFailure,
  type RefinedSegmentSlice,
} from "./refinement/failed-segment-refinement";
import {
  formatSegmentValidationError,
  resolveScriptLineText,
  validateSegmentScript,
} from "./segment-script-validator";
import { saveSegmentScriptToDatabase } from "../storage/persistence";
import type {
  CharacterCandidate,
  DialogueLine,
  SegmentFailureDetail,
  ScriptGenerationOptions,
  SegmentProcessingResult,
} from "../types";

interface LLMClient {
  callLLM(prompt: string, systemPrompt?: string): Promise<string>;
}

type SegmentFailurePatch = Partial<
  Omit<
    SegmentFailureDetail,
    "segmentId" | "chapterId" | "orderIndex" | "message" | "segmentPreview"
  >
>;

interface SegmentWithContext {
  id: string;
  chapterId?: string | null;
  orderIndex?: number;
  content: string;
}

const asTrimmedString = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
};

const asNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return value;
};

const asStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asTrimmedString(entry))
    .filter((entry) => entry.length > 0);
};

const buildSegmentPreview = (content: string): string =>
  content.replace(/\s+/g, " ").trim().slice(0, 120);

const SENTENCE_BOUNDARY_CHARS = new Set([
  "。",
  "！",
  "？",
  "；",
  "!",
  "?",
  "…",
]);

const ATTRIBUTION_TOKEN_PATTERN =
  /(说道|说着|说完|说|问道|问|回答|答道|答|应道|应|回应|回道|回|喊道|喊|叫道|叫|吼道|吼|嚷道|嚷|嘀咕|嘟囔|喃喃|低声说|轻声说|低声道|轻声道|笑道|哭道|提醒|解释|告诉|补充|反问|脱口而出|承认|念起|念起来|念道|念|开口道|开口说|开口)/;
const GENERIC_DAO_PATTERN = /[^，。！？；：,:]{0,12}道(?:[：:,，。\s]|$)/;
const DISPLAY_TEXT_PATTERN =
  /(写着|写道|写有|写明|标着|标明|贴着|贴有|印着|印有|显示着|显示|注明|题着)/;
const PUNCTUATION_ONLY_PATTERN = /^[，。！？；：,:、…—\-\s]+$/;
const COLON_ATTRIBUTION_PATTERN = /[：:]\s*$/;

interface QuoteSpan {
  start: number;
  end: number;
}

interface CanonicalSlice {
  start: number;
  end: number;
  content: string;
}

const trimSlice = (content: string, start: number, end: number): CanonicalSlice => {
  let nextStart = start;
  let nextEnd = end;

  while (nextStart < nextEnd && /\s/.test(content[nextStart])) {
    nextStart += 1;
  }

  while (nextEnd > nextStart && /\s/.test(content[nextEnd - 1])) {
    nextEnd -= 1;
  }

  return {
    start: nextStart,
    end: nextEnd,
    content: content.slice(nextStart, nextEnd),
  };
};

const splitBySentenceBoundaries = (content: string): CanonicalSlice[] => {
  const slices: CanonicalSlice[] = [];
  let cursor = 0;
  const quoteStack: string[] = [];

  for (let index = 0; index < content.length; index += 1) {
    const current = content[index];
    const wasInsideQuote = quoteStack.length > 0;
    updateDialogueQuoteStack(quoteStack, current);

    if (wasInsideQuote || quoteStack.length > 0 || !SENTENCE_BOUNDARY_CHARS.has(current)) {
      continue;
    }

    let end = index + 1;
    while (end < content.length && DIALOGUE_CLOSING_QUOTE_CHARS.has(content[end])) {
      end += 1;
    }

    const slice = trimSlice(content, cursor, end);
    if (slice.content.length > 0) {
      slices.push(slice);
    }
    cursor = end;
  }

  const trailing = trimSlice(content, cursor, content.length);
  if (trailing.content.length > 0) {
    slices.push(trailing);
  }

  return slices.length > 0 ? slices : [trimSlice(content, 0, content.length)];
};

const findQuotedSpans = (content: string): QuoteSpan[] => {
  const spans: QuoteSpan[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    let bestSpan: QuoteSpan | null = null;

    for (const { open, close } of DIALOGUE_QUOTE_PAIRS) {
      const start = content.indexOf(open, cursor);
      if (start < 0) {
        continue;
      }

      const closeIndex = content.indexOf(close, start + open.length);
      if (closeIndex < 0) {
        continue;
      }

      const candidate = {
        start,
        end: closeIndex + close.length,
      };

      if (!bestSpan || candidate.start < bestSpan.start) {
        bestSpan = candidate;
      }
    }

    if (!bestSpan) {
      break;
    }

    spans.push(bestSpan);
    cursor = bestSpan.end;
  }

  return spans;
};

const isAttributionFragment = (value: string): boolean => {
  const normalized = value.trim();
  if (!normalized || DISPLAY_TEXT_PATTERN.test(normalized)) {
    return false;
  }

  return (
    ATTRIBUTION_TOKEN_PATTERN.test(normalized) ||
    GENERIC_DAO_PATTERN.test(normalized) ||
    COLON_ATTRIBUTION_PATTERN.test(normalized) ||
    PUNCTUATION_ONLY_PATTERN.test(normalized)
  );
};

const buildNarrationVariants = (params: {
  line: DialogueLine;
  sourceText: string;
  baseStart: number;
}): DialogueLine[] => {
  const { line, sourceText, baseStart } = params;
  const slices = splitBySentenceBoundaries(sourceText).filter(
    (slice) => slice.content.length > 0
  );

  return slices.map((slice, index) => ({
    ...line,
    id: `${line.id}::narration-${index + 1}`,
    characterName: "旁白",
    rawSpeaker: "旁白",
    roleType: "narration",
    isNarration: true,
    text: slice.content,
    ttsParameters: {
      ...(line.ttsParameters || {}),
      originalSpeaker: "旁白",
      sourceText: slice.content,
      sourceStart: baseStart + slice.start,
      sourceEnd: baseStart + slice.end,
    },
  }));
};

const splitAttributedDialogueLine = (line: DialogueLine): DialogueLine[] | null => {
  const ttsParameters =
    line.ttsParameters && typeof line.ttsParameters === "object"
      ? line.ttsParameters
      : {};
  const sourceText = asTrimmedString(ttsParameters.sourceText);
  const baseStart =
    typeof ttsParameters.sourceStart === "number" ? ttsParameters.sourceStart : 0;

  if (!sourceText || line.rawSpeaker === "旁白") {
    return null;
  }

  const spans = findQuotedSpans(sourceText);
  if (spans.length === 0) {
    return null;
  }

  const fragments: CanonicalSlice[] = [];
  let cursor = 0;

  for (const span of spans) {
    const fragment = trimSlice(sourceText, cursor, span.start);
    if (fragment.content.length > 0) {
      fragments.push(fragment);
    }
    cursor = span.end;
  }

  const trailingFragment = trimSlice(sourceText, cursor, sourceText.length);
  if (trailingFragment.content.length > 0) {
    fragments.push(trailingFragment);
  }

  if (
    fragments.length === 0 ||
    fragments.some((fragment) => !isAttributionFragment(fragment.content))
  ) {
    return null;
  }

  const variants: DialogueLine[] = [];
  cursor = 0;
  let fragmentIndex = 0;
  let quoteIndex = 0;

  for (const span of spans) {
    const fragment = trimSlice(sourceText, cursor, span.start);
    if (fragment.content.length > 0 && !PUNCTUATION_ONLY_PATTERN.test(fragment.content)) {
      variants.push(
        ...buildNarrationVariants({
          line,
          sourceText: fragment.content,
          baseStart: baseStart + fragment.start,
        }).map((variant) => ({
          ...variant,
          id: `${line.id}::fragment-${fragmentIndex++}`,
        }))
      );
    }

    const quote = trimSlice(sourceText, span.start, span.end);
    if (quote.content.length > 0) {
      variants.push({
        ...line,
        id: `${line.id}::dialogue-${quoteIndex++}`,
        text: resolveScriptLineText({
          sourceText: quote.content,
          speaker: line.rawSpeaker || line.characterName || "未知",
        }),
        ttsParameters: {
          ...ttsParameters,
          sourceText: quote.content,
          sourceStart: baseStart + quote.start,
          sourceEnd: baseStart + quote.end,
        },
      });
    }

    cursor = span.end;
  }

  const trailing = trimSlice(sourceText, cursor, sourceText.length);
  if (trailing.content.length > 0 && !PUNCTUATION_ONLY_PATTERN.test(trailing.content)) {
    variants.push(
      ...buildNarrationVariants({
        line,
        sourceText: trailing.content,
        baseStart: baseStart + trailing.start,
      }).map((variant) => ({
        ...variant,
        id: `${line.id}::fragment-${fragmentIndex++}`,
      }))
    );
  }

  return variants.length > 0 ? variants : null;
};

const canonicalizeDialogueLines = (dialogueLines: DialogueLine[]): DialogueLine[] => {
  const expanded = dialogueLines.flatMap((line) => {
    const ttsParameters =
      line.ttsParameters && typeof line.ttsParameters === "object"
        ? line.ttsParameters
        : {};
    const sourceText = asTrimmedString(ttsParameters.sourceText);
    const baseStart =
      typeof ttsParameters.sourceStart === "number" ? ttsParameters.sourceStart : 0;

    if (line.rawSpeaker === "旁白" && sourceText) {
      return buildNarrationVariants({
        line,
        sourceText,
        baseStart,
      });
    }

    return splitAttributedDialogueLine(line) || [line];
  });

  return expanded.map((line, index) => ({
    ...line,
    orderInSegment: index,
  }));
};

const MAX_REFINEMENT_DEPTH = 2;

const buildSegmentFailureDetail = (params: {
  segment: SegmentWithContext;
  message: string;
  patch?: SegmentFailurePatch;
}): SegmentFailureDetail => {
  const { segment, message, patch } = params;
  const issueCodes = patch?.issueCodes || [];
  const issueMessages = patch?.issueMessages || [];
  const issuePreviews = patch?.issuePreviews || [];

  return {
    segmentId: segment.id,
    chapterId: segment.chapterId ?? null,
    orderIndex:
      typeof segment.orderIndex === "number" && Number.isFinite(segment.orderIndex)
        ? segment.orderIndex
        : -1,
    stage: patch?.stage || "unknown",
    errorCode: patch?.errorCode || "UNKNOWN_ERROR",
    message,
    provider: patch?.provider || null,
    retryable: patch?.retryable === true,
    coverageRatio: asNumber(patch?.coverageRatio),
    issueCodes,
    issueMessages,
    issuePreviews,
    segmentPreview: buildSegmentPreview(segment.content),
  };
};

const throwSegmentError = (params: {
  segment: SegmentWithContext;
  message: string;
  provider: string;
  patch?: SegmentFailurePatch;
}): never => {
  const { segment, message, provider, patch } = params;
  const error = new TTSError(message, "TTS_SERVICE_DOWN", provider);
  error.details = buildSegmentFailureDetail({ segment, message, patch });
  throw error;
};

const buildCharacterInfoText = (characterProfiles: any[]): string => {
  const characterInfo = characterProfiles
    .map((char) => {
      const aliases = char.aliases.map((a: any) => a.alias).join(", ");
      const characteristics = (char.characteristics as any) || {};
      const voicePreferences = (char.voicePreferences as any) || {};
      return {
        name: char.canonicalName,
        aliases,
        gender: char.genderHint || "unknown",
        age: char.ageHint?.toString() || "未知",
        personality: Array.isArray(characteristics.personality)
          ? characteristics.personality.join(", ")
          : characteristics.personality,
        dialogueStyle: voicePreferences.dialogueStyle || "自然",
        importance: characteristics.importance || "secondary",
      };
    })
    .filter((char) => char.name !== "旁白");

  if (characterInfo.length === 0) {
    return "无";
  }

  return characterInfo
    .map(
      (char, index) =>
        `${index + 1}. ${char.name}\n` +
        `   别名: ${char.aliases || "无"}\n` +
        `   性别: ${char.gender}, 年龄: ${char.age}\n` +
        `   性格特征: ${char.personality}\n` +
        `   对话风格: ${char.dialogueStyle}\n` +
        `   重要程度: ${char.importance}\n`
    )
    .join("\n");
};

const remapRefinedDialogueLines = (params: {
  parentSegment: SegmentWithContext;
  refinedSegments: RefinedSegmentSlice[];
  refinedResults: SegmentProcessingResult[];
}): SegmentProcessingResult => {
  const { parentSegment, refinedSegments, refinedResults } = params;
  const dialogueLines: DialogueLine[] = [];
  const characterCandidates: CharacterCandidate[] = [];

  refinedResults.forEach((result, resultIndex) => {
    const refinedSegment = refinedSegments[resultIndex];
    characterCandidates.push(...result.characterCandidates);

    result.dialogueLines.forEach((line) => {
      const ttsParameters =
        line.ttsParameters && typeof line.ttsParameters === "object"
          ? { ...line.ttsParameters }
          : {};
      const sourceStart =
        typeof ttsParameters.sourceStart === "number"
          ? ttsParameters.sourceStart + refinedSegment.offsetStart
          : refinedSegment.offsetStart;
      const sourceEnd =
        typeof ttsParameters.sourceEnd === "number"
          ? ttsParameters.sourceEnd + refinedSegment.offsetStart
          : refinedSegment.offsetEnd;

      dialogueLines.push({
        ...line,
        id: `${parentSegment.id}_${dialogueLines.length}`,
        segmentId: parentSegment.id,
        chapterId: parentSegment.chapterId ?? null,
        orderInSegment: dialogueLines.length,
        ttsParameters: {
          ...ttsParameters,
          sourceStart,
          sourceEnd,
        },
      });
    });
  });

  return {
    dialogueLines,
    characterCandidates,
  };
};

const buildSystemPrompt = (
  characterInfoText: string,
  options: ScriptGenerationOptions
): string => {
  return `你是一个严格的小说台本抽取器，不是改写器，不是总结器，也不是润色器。

你的唯一任务是把原文逐条映射成可朗读台本，并保持 100% 原文覆盖。

已知角色信息：
${characterInfoText}

强制规则：
1. 必须完整覆盖原文，不能遗漏任何非空白内容。
2. 不能总结、压缩、改写、解释或补写原文。
3. 每条 dialogues 都必须包含 sourceText，且 sourceText 必须是原文中的连续原句切片。
4. 所有 sourceText 必须按原文顺序出现，且每段原文只能映射一次，不能重复抽取。
5. 引号中的对白不能同时出现在旁白句和对白句中。
6. narration 的 text 必须与 sourceText 完全一致；dialogue 的 text 只能保留真正可朗读的正文。
   - 纯引号对白如 “你好。”，text 应为 你好。
   - 当 sourceText 含归属语或动作时，dialogue 的 text 只能保留真正说出口的对白正文。
   - 例如 sourceText 为 张三说：“你好。” 时，text 应为 你好。；sourceText 为 “走吧。”他站起身。 时，text 应为 走吧。
   - 标语、牌子、题词等没有明确说话人的引号文本，如果原样朗读，speaker 必须是“旁白”，text 必须与 sourceText 完全一致。
7. 如果某句较长，不要删字，必须按原文句界继续拆分，单条 text 尽量不超过 ${options.maxDialogueLength} 个字符。
8. 极短语气词、短回答、拟声词也必须保留，不能因为太短而省略。
9. speaker 只能使用已知角色、新识别角色，或“旁白”；无法确定时使用“未知”，不要乱猜。
10. characters 里只放本段新增角色或新增别名；旁白不要进入角色列表。

请返回严格 JSON 对象：
{
  "dialogues": [
    {
      "id": "sentence_001",
      "sourceText": "“你好。”",
      "text": "你好。",
      "speaker": "张三",
      "tone": "平静",
      "strength": 75,
      "pauseAfter": 1.5,
      "ttsHints": {
        "pitch": 1.0,
        "rate": 1.0,
        "emphasis": ""
      }
    }
  ],
  "characters": [
    {
      "name": "角色名",
      "aliases": ["别名1", "别名2"],
      "description": "角色描述",
      "gender": "male/female/unknown",
      "age": "大致年龄",
      "personality": ["性格1", "性格2"],
      "importance": "main/secondary/minor",
      "dialogueStyle": "对话风格"
    }
  ]
}

输出要求：
- 只返回 JSON，不要包含 Markdown、解释或额外文字。
- 如果本段没有新增角色，characters 返回 []。
- dialogues 必须覆盖输入原文中的全部非空白内容。`;
};

const buildSegmentPrompt = (segmentContent: string): string => {
  return `请分析下面这段原文，严格按顺序输出台本：

【原文开始】
${segmentContent}
【原文结束】

再次提醒：
- 每条 dialogues 都要提供原文切片 sourceText。
- sourceText 必须是上面原文中的原样子串。
- 不要漏字，不要重抽，不要把对白再复述成旁白。
- 带归属语的对白只保留真正说出口的正文；没有明确说话人的引号文本才允许作为旁白原样保留。
- 最终只输出一个 JSON 对象。`;
};

const resolveScriptSentences = (result: any): any[] => {
  if (Array.isArray(result)) {
    return result;
  }

  if (result.dialogues && Array.isArray(result.dialogues)) {
    return result.dialogues;
  }

  if (result.dialogueLines && Array.isArray(result.dialogueLines)) {
    return result.dialogueLines;
  }

  console.warn("未找到有效的台词数据，使用空数组");
  return [];
};

const resolveRawCharacters = (result: any): any[] => {
  if (result.characters && Array.isArray(result.characters)) {
    return result.characters;
  }

  if (result.newCharacters && Array.isArray(result.newCharacters)) {
    return result.newCharacters;
  }

  return [];
};

const ensureDialogueLengthCap = (params: {
  segment: SegmentWithContext;
  dialogueLines: DialogueLine[];
  maxDialogueLength: number;
}) => {
  const { segment, dialogueLines, maxDialogueLength } = params;
  const oversizedLine = dialogueLines.find(
    (line) => line.text.trim().length > maxDialogueLength
  );

  if (!oversizedLine) {
    return;
  }

  throwSegmentError({
    segment,
    message: `段落 ${segment.id} 存在超长台词，长度 ${oversizedLine.text.trim().length} 超过上限 ${maxDialogueLength}`,
    provider: "script-validator",
    patch: {
      stage: "dialogue_length",
      errorCode: "DIALOGUE_TOO_LONG",
      issueCodes: ["DIALOGUE_TOO_LONG"],
      issueMessages: [
        `长度 ${oversizedLine.text.trim().length} 超过上限 ${maxDialogueLength}`,
      ],
      issuePreviews: [oversizedLine.text.trim().slice(0, 40)],
      retryable: false,
    },
  });
};

const buildStagedCharacterMap = (params: {
  characterCandidates: CharacterCandidate[];
  characterMap: Map<string, string>;
}) => {
  const { characterCandidates, characterMap } = params;
  const stagedCharacterMap = new Map(characterMap);
  const stagedProfiles: Array<{
    canonicalName: string;
    aliases: Array<{ alias: string }>;
  }> = [];

  for (const candidate of characterCandidates) {
    const canonicalName = resolveCandidateCanonicalName(
      candidate,
      stagedCharacterMap
    );
    const aliasSet = new Set<string>(candidate.aliases);
    if (candidate.name !== canonicalName) {
      aliasSet.add(candidate.name);
    }

    const stagedProfile = {
      canonicalName,
      aliases: [...aliasSet].map((alias) => ({ alias })),
    };

    addCharacterToMap(stagedCharacterMap, stagedProfile);
    stagedProfiles.push(stagedProfile);
  }

  return { stagedCharacterMap, stagedProfiles };
};

const commitStagedCharacterMap = (params: {
  characterMap: Map<string, string>;
  stagedProfiles: Array<{
    canonicalName: string;
    aliases: Array<{ alias: string }>;
  }>;
}) => {
  const { characterMap, stagedProfiles } = params;

  for (const profile of stagedProfiles) {
    addCharacterToMap(characterMap, profile);
  }
};

const mapDialogueLines = (params: {
  segment: any;
  scriptSentences: any[];
  characterMap: Map<string, string>;
}): DialogueLine[] => {
  const { segment, scriptSentences, characterMap } = params;
  const validation = validateSegmentScript({
    segmentContent: segment.content,
    scriptSentences,
  });

  if (!validation.valid) {
    console.warn("段落台本校验失败", {
      segmentId: segment.id,
      coverageRatio: validation.coverageRatio,
      issues: validation.issues,
    });
    throwSegmentError({
      segment,
      message: formatSegmentValidationError(validation),
      provider: "script-validator",
      patch: {
        stage: "script_validation",
        errorCode: "SCRIPT_VALIDATION_FAILED",
        coverageRatio: validation.coverageRatio,
        issueCodes: validation.issues.map((issue) => issue.code),
        issueMessages: validation.issues.map((issue) => issue.message),
        issuePreviews: validation.issues
          .map((issue) => asTrimmedString(issue.preview))
          .filter((preview) => preview.length > 0),
        retryable: false,
      },
    });
  }

  const mappedLines: DialogueLine[] = validation.lines.map((validatedLine, index) => {
    const sentence = scriptSentences[index] || {};
    let characterName = validatedLine.speaker || "未知";

    if (characterName !== "旁白" && characterName !== "未知") {
      characterName = characterMap.get(characterName) || characterName;
    }

    const ttsHints =
      sentence.ttsHints && typeof sentence.ttsHints === "object"
        ? sentence.ttsHints
        : {
            pitch: 1.0,
            rate: 1.0,
            emphasis: "",
          };

    const text = validatedLine.resolvedText;

    return {
      id: sentence.id || `${segment.id}_${index}`,
      characterName,
      rawSpeaker: validatedLine.speaker,
      text,
      tone: sentence.tone || "中性",
      roleType: characterName === "旁白" ? "narration" : "dialogue",
      emotionLabel:
        typeof sentence.emotionLabel === "string"
          ? sentence.emotionLabel
          : undefined,
      emotionIntensity:
        typeof sentence.emotionIntensity === "number"
          ? sentence.emotionIntensity
          : undefined,
      engineHint:
        typeof sentence.engineHint === "string" ? sentence.engineHint : undefined,
      priority:
        sentence.priority === "high" ||
        sentence.priority === "normal" ||
        sentence.priority === "low"
          ? sentence.priority
          : undefined,
      prosody:
        sentence.prosody && typeof sentence.prosody === "object"
          ? sentence.prosody
          : undefined,
      strength: typeof sentence.strength === "number" ? sentence.strength : 75,
      pauseAfter:
        typeof sentence.pauseAfter === "number" ? sentence.pauseAfter : 1.5,
      segmentId: segment.id,
      chapterId: segment.chapterId,
      orderInSegment: index,
      isNarration: characterName === "旁白",
      ttsParameters: {
        ttsHints,
        originalSpeaker: validatedLine.speaker,
        sourceText: validatedLine.sourceText,
        sourceStart: validatedLine.sourceStart,
        sourceEnd: validatedLine.sourceEnd,
        engineHint:
          typeof sentence.engineHint === "string"
            ? sentence.engineHint
            : undefined,
        strength: typeof sentence.strength === "number" ? sentence.strength : 75,
        pauseAfter:
          typeof sentence.pauseAfter === "number" ? sentence.pauseAfter : 1.5,
        confidence: 0.8,
      },
    };
  });

  return canonicalizeDialogueLines(mappedLines);
};

export async function processSegment(params: {
  llmService: LLMClient;
  segment: any;
  characterMap: Map<string, string>;
  characterProfiles: any[];
  options: ScriptGenerationOptions;
}): Promise<SegmentProcessingResult> {
  const { llmService, segment, characterMap, characterProfiles, options } =
    params;

  const characterInfoText = buildCharacterInfoText(characterProfiles);
  const systemPrompt = buildSystemPrompt(characterInfoText, options);
  const prompt = buildSegmentPrompt(segment.content);

  const response = await llmService.callLLM(prompt, systemPrompt);
  console.log("LLM台本响应长度", { segmentId: segment.id, length: response.length });

  try {
    const result = await parseLLMJsonResult(llmService, response);
    const scriptSentences = resolveScriptSentences(result);
    const rawCharacters = resolveRawCharacters(result);

    const characterCandidates = normalizeCharacterCandidates(rawCharacters);
    const { stagedCharacterMap, stagedProfiles } = buildStagedCharacterMap({
      characterCandidates,
      characterMap,
    });

    const dialogueLines = mapDialogueLines({
      segment,
      scriptSentences,
      characterMap: stagedCharacterMap,
    }).filter((line) => line.text.trim().length > 0);

    ensureDialogueLengthCap({
      segment,
      dialogueLines,
      maxDialogueLength: options.maxDialogueLength,
    });

    commitStagedCharacterMap({
      characterMap,
      stagedProfiles,
    });

    return { dialogueLines, characterCandidates };
  } catch (error) {
    if (error instanceof TTSError) {
      throw error;
    }

    console.error("台本解析失败:", error);
    const parseError = new TTSError(
      "台本生成失败，LLM返回格式错误",
      "TTS_SERVICE_DOWN",
      "script-generator",
      true
    );
    parseError.details = buildSegmentFailureDetail({
      segment,
      message: "台本生成失败，LLM返回格式错误",
      patch: {
        stage: "llm_parse",
        errorCode: "LLM_JSON_PARSE_FAILED",
        retryable: true,
      },
    });
    throw parseError;
  }
}

const processSegmentWithRefinement = async (params: {
  llmService: LLMClient;
  segment: any;
  characterMap: Map<string, string>;
  characterProfiles: any[];
  options: ScriptGenerationOptions;
  refinementDepth?: number;
}): Promise<SegmentProcessingResult> => {
  const {
    llmService,
    segment,
    characterMap,
    characterProfiles,
    options,
    refinementDepth = 0,
  } = params;

  try {
    return await processSegment({
      llmService,
      segment,
      characterMap,
      characterProfiles,
      options,
    });
  } catch (error) {
    if (!(error instanceof TTSError) || refinementDepth >= MAX_REFINEMENT_DEPTH) {
      throw error;
    }

    const failureRecord =
      error.details && typeof error.details === "object" && !Array.isArray(error.details)
        ? (error.details as Record<string, unknown>)
        : null;

    const issueCodes = asStringList(failureRecord?.issueCodes);
    const coverageRatio = asNumber(failureRecord?.coverageRatio);

    if (
      !shouldRefineSegmentFailure({
        errorCode: asTrimmedString(failureRecord?.errorCode),
        issueCodes,
        coverageRatio,
      })
    ) {
      throw error;
    }

    const refinedSegments = refineFailedSegment({
      segment: {
        id: segment.id,
        chapterId: segment.chapterId ?? null,
        orderIndex: segment.orderIndex,
        content: segment.content,
      },
      failure: {
        errorCode: asTrimmedString(failureRecord?.errorCode),
        issueCodes,
        coverageRatio,
      },
    });

    if (refinedSegments.length <= 1) {
      throw error;
    }

    const stagedCharacterMap = new Map(characterMap);
    const refinedResults: SegmentProcessingResult[] = [];

    for (const refinedSegment of refinedSegments) {
      const refinedResult = await processSegmentWithRefinement({
        llmService,
        segment: {
          id: refinedSegment.id,
          chapterId: refinedSegment.chapterId,
          orderIndex: refinedSegment.orderIndex,
          content: refinedSegment.content,
        },
        characterMap: stagedCharacterMap,
        characterProfiles,
        options,
        refinementDepth: refinementDepth + 1,
      });
      refinedResults.push(refinedResult);
    }

    return remapRefinedDialogueLines({
      parentSegment: segment,
      refinedSegments,
      refinedResults,
    });
  }
};

export async function processSegmentAndSave(params: {
  llmService: LLMClient;
  segment: any;
  characterMap: Map<string, string>;
  characterProfiles: any[];
  options: ScriptGenerationOptions;
  bookId: string;
}): Promise<SegmentProcessingResult> {
  const { llmService, segment, characterMap, characterProfiles, options, bookId } =
    params;

  const result = await processSegmentWithRefinement({
    llmService,
    segment,
    characterMap,
    characterProfiles,
    options,
  });

  if (result.dialogueLines.length === 0) {
    throw new TTSError(
      `段落 ${segment.id} 未生成有效台词`,
      "TTS_SERVICE_DOWN",
      "script-generator"
    );
  }

  if (result.characterCandidates.length > 0) {
    await upsertCharacterCandidates({
      bookId,
      candidates: result.characterCandidates,
      characterProfiles,
      characterMap,
    });
  }

  await saveSegmentScriptToDatabase({
    bookId,
    segmentId: segment.id,
    dialogueLines: result.dialogueLines,
    characterProfiles,
    characterMap,
  });

  return result;
}
