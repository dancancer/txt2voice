// 一旦我被更新，请更新我的开头注释
// input: SCRIPT_VALIDATION 复核卡片数据
// output: 详情区渲染断言
// pos: review 队列卡片测试
import { renderToStaticMarkup } from "react-dom/server.node";
import { ReviewQueueList } from "../ReviewQueueList";
import { SCRIPT_VALIDATION_ISSUE_TYPE } from "@/lib/script-validation-review";
import type { ManualReviewItem } from "../../models/types";

const buildItem = (): ManualReviewItem => ({
  id: "review-1",
  bookId: "book-1",
  chapterId: "chapter-1",
  segmentId: "segment-7",
  sentenceId: null,
  audioFileId: null,
  issueType: SCRIPT_VALIDATION_ISSUE_TYPE,
  issueSubtype: "COVERAGE",
  recommendedAction: "regenerate",
  recommendedActionLabel: "重生",
  priority: "high",
  status: "pending",
  issueDetail: {
    issueCodes: ["LOW_COVERAGE"],
    issueMessages: ["原文覆盖率过低", "尾部存在未覆盖内容"],
    issuePreviews: ["第二段原文"],
    segmentPreview: "第二段原文，有校验问题",
    segmentContent: "第二段原文，有校验问题。完整段落内容在这里。",
    rawResponse: '{"dialogues":[],"characters":[]}',
    structuredResult: {
      dialogues: [],
      characters: [],
    },
    coverageRatio: 0.82,
  },
  assignedTo: null,
  resolutionType: null,
  resolutionNote: null,
  resolvedAt: null,
  createdAt: "2026-03-12T00:00:00.000Z",
  updatedAt: "2026-03-12T00:10:00.000Z",
  sentence: null,
  audio: null,
  latestQualityCheck: null,
});

describe("ReviewQueueList", () => {
  it("should render issue messages and script action hints for script validation items", () => {
    const html = renderToStaticMarkup(
      <ReviewQueueList
        items={[buildItem()]}
        loading={false}
        actionLoadingItemId={null}
        batchActionLoading={false}
        scriptSaveLoadingItemId={null}
        onResolve={() => undefined}
        onBatchResolve={async () => true}
        onSaveScriptEdit={async () => true}
      />
    );

    expect(html).toContain("完整问题列表");
    expect(html).toContain("原文覆盖率过低");
    expect(html).toContain("尾部存在未覆盖内容");
    expect(html).toContain("问题代码");
    expect(html).toContain("问题原文预览");
    expect(html).toContain("当前生成结果预览");
    expect(html).toContain("段落原文");
    expect(html).toContain("段落原文预览");
    expect(html).toContain("建议动作");
    expect(html).toContain("推荐动作：重生");
    expect(html).toContain("重生（推荐）");
    expect(html).toContain("打开修订工作台");
    expect(html).toContain("优先重生台本，确认这一段是否需要更小粒度切段。");
  });
});
