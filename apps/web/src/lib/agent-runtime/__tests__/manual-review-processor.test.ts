import { TTSError } from "@/lib/error-handler";
import { buildSegmentProcessingResultFromStructuredResult } from "../runtime/script-production/manual-review-processor";

const baseParams = () => ({
  segment: {
    id: "segment-1",
    chapterId: "chapter-1",
    orderIndex: 0,
    content: "“小雄!”关玮抓过床单裹住身体喊住了他，咽了口唾液说,“你都看到了？”",
  },
  characterMap: new Map([
    ["关玮", "关玮"],
  ]),
  options: {
    includeNarration: true,
    emotionDetection: true,
    contextAnalysis: true,
    minDialogueLength: 1,
    maxDialogueLength: 200,
    preserveOriginalBreaks: true,
  },
});

describe("manual review processor", () => {
  it("allows manual edited lines to preserve user text when sourceText still maps to the original segment", () => {
    const result = buildSegmentProcessingResultFromStructuredResult({
      ...baseParams(),
      mode: "manual_edit",
      structuredResult: {
        dialogues: [
          {
            id: "line-1",
            sourceText: "“小雄!”关玮抓过床单裹住身体喊住了他，咽了口唾液说,“你都看到了？”",
            text: "小雄！",
            speaker: "关玮",
            tone: "急促",
          },
        ],
        characters: [],
      },
    });

    expect(result.dialogueLines).toHaveLength(1);
    expect(result.dialogueLines[0]).toMatchObject({
      text: "小雄！",
      rawSpeaker: "关玮",
      characterName: "关玮",
    });
    expect(result.dialogueLines[0]?.ttsParameters).toMatchObject({
      sourceText:
        "“小雄!”关玮抓过床单裹住身体喊住了他，咽了口唾液说,“你都看到了？”",
    });
  });

  it("keeps generated mode strict for text/source mismatches", () => {
    expect(() =>
      buildSegmentProcessingResultFromStructuredResult({
        ...baseParams(),
        structuredResult: {
          dialogues: [
            {
              id: "line-1",
              sourceText:
                "“小雄!”关玮抓过床单裹住身体喊住了他，咽了口唾液说,“你都看到了？”",
              text: "小雄！",
              speaker: "关玮",
              tone: "急促",
            },
          ],
          characters: [],
        },
      })
    ).toThrow(TTSError);
  });
});
