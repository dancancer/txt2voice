import { renderToStaticMarkup } from "react-dom/server.node";
import {
  buildInitialDraft,
  ReviewScriptEditWorkspace,
  toStructuredResult,
} from "../ReviewScriptEditWorkspace";
import { SCRIPT_VALIDATION_ISSUE_TYPE } from "@/lib/script-validation-review";
import type { ManualReviewItem } from "../../models/types";

const buildItem = (): ManualReviewItem => ({
  id: "review-script-workspace-1",
  bookId: "book-1",
  chapterId: "chapter-1",
  segmentId: "segment-1",
  sentenceId: null,
  audioFileId: null,
  issueType: SCRIPT_VALIDATION_ISSUE_TYPE,
  issueSubtype: "COVERAGE",
  recommendedAction: "regenerate",
  recommendedActionLabel: "重生",
  priority: "high",
  status: "pending",
  issueDetail: {
    stage: "script_validation",
    errorCode: "SCRIPT_VALIDATION_FAILED",
    issueMessages: ["原文覆盖率过低"],
    issuePreviews: ["她往殿中黄金大榻一靠"],
    segmentPreview: "她往殿中黄金大榻一靠……",
    segmentContent:
      "她往殿中黄金大榻一靠，抬手轻挥：“人多心乱，都撤了吧。”闵弘芳又一拍手，侍女们便快步消失在了侧门之外。",
    rawResponse:
      '{"dialogues":[{"id":"line-1","sourceText":"她往殿中黄金大榻一靠，抬手轻挥：“人多心乱，都撤了吧。”","text":"人多心乱，都撤了吧。","speaker":"未知","tone":"平静"}],"characters":[]}',
    structuredResult: {
      dialogues: [
        {
          id: "line-1",
          sourceText: "她往殿中黄金大榻一靠，抬手轻挥：“人多心乱，都撤了吧。”",
          text: "人多心乱，都撤了吧。",
          speaker: "未知",
          tone: "平静",
        },
      ],
      characters: [],
    },
  },
  assignedTo: null,
  resolutionType: null,
  resolutionNote: null,
  resolvedAt: null,
  createdAt: "2026-03-23T10:00:00.000Z",
  updatedAt: "2026-03-23T10:01:00.000Z",
  sentence: null,
  audio: null,
  latestQualityCheck: null,
});

describe("ReviewScriptEditWorkspace", () => {
  it("should render full-screen editing workspace with original content and structured editor", () => {
    const html = renderToStaticMarkup(
      <ReviewScriptEditWorkspace
        open
        item={buildItem()}
        saving={false}
        onClose={() => undefined}
        onSave={async () => true}
      />
    );

    expect(html).toContain("台本修订工作台");
    expect(html).toContain("段落原文");
    expect(html).toContain("结构化台本编辑");
    expect(html).toContain("原始生成结果");
    expect(html).toContain("变更摘要");
    expect(html).toContain("角色候选");
    expect(html).toContain("保存并通过");
    expect(html).toContain("人多心乱，都撤了吧。");
    expect(html).toContain("原文覆盖率过低");
  });

  it("should render runtime draft lines when structuredResult uses lines shape", () => {
    const item = buildItem();
    item.issueDetail = {
      ...(item.issueDetail as Record<string, unknown>),
      rawResponse:
        '{"lines":[{"id":"line-1","sourceText":"她往殿中黄金大榻一靠，抬手轻挥：“人多心乱，都撤了吧。”","text":"人多心乱，都撤了吧。","speaker":"未知","orderInSegment":0}]}',
      structuredResult: {
        segmentId: "segment-1",
        createdAt: "2026-03-23T10:00:00.000Z",
        lines: [
          {
            id: "line-1",
            sourceText: "她往殿中黄金大榻一靠，抬手轻挥：“人多心乱，都撤了吧。”",
            text: "人多心乱，都撤了吧。",
            speaker: "未知",
            orderInSegment: 0,
          },
        ],
      },
    };

    const html = renderToStaticMarkup(
      <ReviewScriptEditWorkspace
        open
        item={item}
        saving={false}
        onClose={() => undefined}
        onSave={async () => true}
      />
    );

    expect(html).toContain("人多心乱，都撤了吧。");
    expect(html).toContain("未知");
  });

  it("should prefer manual edited structured result when rebuilding the draft", () => {
    const item = buildItem();
    item.issueDetail = {
      ...(item.issueDetail as Record<string, unknown>),
      structuredResult: {
        dialogues: [
          {
            id: "line-1",
            sourceText: "原始结果",
            text: "原始结果",
            speaker: "未知",
            tone: "平静",
          },
        ],
        characters: [],
      },
      manualEditedStructuredResult: {
        dialogues: [
          {
            id: "line-1",
            sourceText: "人工修订结果",
            text: "人工修订结果",
            speaker: "旁白",
            tone: "冷静",
          },
        ],
        characters: [],
      },
    };

    const draft = buildInitialDraft(item);

    expect(draft.dialogues[0]).toMatchObject({
      sourceText: "人工修订结果",
      text: "人工修订结果",
      speaker: "旁白",
      tone: "冷静",
    });
  });

  it("should preserve personality metadata when serializing structured result", () => {
    const structuredResult = toStructuredResult({
      dialogues: [],
      characters: [
        {
          name: "小雄",
          aliases: "阿雄, 雄哥",
          description: "一位沉稳的副官",
          personality: "冷静, 果断",
          gender: "male",
          age: "28",
          dialogueStyle: "克制",
          importance: "main",
        },
      ],
    });

    expect(structuredResult).toMatchObject({
      characters: [
        {
          name: "小雄",
          aliases: ["阿雄", "雄哥"],
          description: "一位沉稳的副官",
          personality: ["冷静", "果断"],
          gender: "male",
          age: "28",
          dialogueStyle: "克制",
          importance: "main",
        },
      ],
    });
  });

  it("should reserve a dedicated scroll container for the structured editor column", () => {
    const html = renderToStaticMarkup(
      <ReviewScriptEditWorkspace
        open
        item={buildItem()}
        saving={false}
        onClose={() => undefined}
        onSave={async () => true}
      />
    );

    expect(html).toContain("flex min-h-0 flex-1 flex-col");
    expect(html).toContain("min-h-0 flex-1 overflow-y-auto");
  });

  it("should render dialogue reorder controls and recognized speaker selector", () => {
    const item = buildItem();
    item.issueDetail = {
      ...(item.issueDetail as Record<string, unknown>),
      structuredResult: {
        dialogues: [
          {
            id: "line-1",
            sourceText: "“你好”",
            text: "你好",
            speaker: "小雄",
            tone: "平静",
          },
        ],
        characters: [
          {
            name: "小雄",
            aliases: [],
            description: "",
            gender: "unknown",
            age: null,
            personality: [],
            importance: "main",
            dialogueStyle: "",
          },
        ],
      },
    };

    const html = renderToStaticMarkup(
      <ReviewScriptEditWorkspace
        open
        item={item}
        saving={false}
        onClose={() => undefined}
        onSave={async () => true}
      />
    );

    expect(html).toContain("上移第 1 条台词");
    expect(html).toContain("下移第 1 条台词");
    expect(html).toContain("speaker（从已识别角色选择）");
    expect(html).toContain("<option value=\"小雄\" selected=\"\">小雄</option>");
  });
});
