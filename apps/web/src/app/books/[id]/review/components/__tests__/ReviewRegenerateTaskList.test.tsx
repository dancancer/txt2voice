// 一旦我被更新，请更新我的开头注释
// input: review 重生任务列表 props
// output: 重生任务状态渲染与排序断言
// pos: review 重生任务组件测试
import { renderToStaticMarkup } from "react-dom/server.node";
import {
  ReviewRegenerateTaskList,
  REVIEW_REGENERATE_CATEGORY_LABELS,
  REVIEW_REGENERATE_SOURCE_LABELS,
} from "../ReviewRegenerateTaskList";
import type { ReviewRegenerateTask } from "../../models/types";
import { toRegenerateTask } from "../../hooks/useReviewWorkbenchData-helpers";
import { sortReviewRegenerateTasks } from "../../hooks/useReviewWorkbenchData";

const buildTask = (
  overrides: Partial<ReviewRegenerateTask> = {}
): ReviewRegenerateTask => ({
  id: "task-1",
  taskType: "SCRIPT_GENERATION",
  status: "processing",
  progress: 42,
  message: "段落重新生成进行中",
  errorMessage: null,
  createdAt: "2026-03-22T06:00:00.000Z",
  updatedAt: "2026-03-22T06:01:00.000Z",
  completedAt: null,
  category: "manual_review_regenerate",
  source: "manual_review_batch",
  targetCount: 3,
  segmentIds: [],
  failureSummary: null,
  ...overrides,
});

describe("ReviewRegenerateTaskList", () => {
  it("should render empty state when no regenerate tasks exist", () => {
    const html = renderToStaticMarkup(
      <ReviewRegenerateTaskList tasks={[]} loading={false} />
    );

    expect(html).toContain("最近台本失败与重生任务");
    expect(html).toContain("当前还没有台本失败或重生任务");
    expect(html).not.toContain("任务ID:");
  });

  it("should render processing task progress and source label", () => {
    const html = renderToStaticMarkup(
      <ReviewRegenerateTaskList
        tasks={[buildTask({ message: "processing-token-message" })]}
        loading={false}
      />
    );

    expect(html).toContain("批量重生");
    expect(html).toContain("重生任务");
    expect(html).toContain("42%");
    expect(html).toContain("目标 3 条");
    expect(html).toContain("processing-token-message");
    expect(html).toContain("id=\"task-task-1\"");
  });

  it("should render failed summary details and stable task anchor id", () => {
    const html = renderToStaticMarkup(
      <ReviewRegenerateTaskList
        tasks={[
          buildTask({
            id: "task-failed",
            status: "failed",
            progress: 90,
            message: "failed-token-message",
            errorMessage: "failed-token-error",
            category: "script_failure",
            source: null,
            failureSummary: {
              segmentId: "seg-3",
              orderIndex: 2,
              stage: "segment_repair",
              errorCode: "SEGMENT_REPAIR_FAILED",
              message: "Invalid repair payload line: required fields are invalid",
            },
          }),
        ]}
        loading={false}
      />
    );

    expect(html).toContain("失败任务");
    expect(html).toContain("系统记录");
    expect(html).toContain("failed-token-message");
    expect(html).toContain("failed-token-error");
    expect(html).toContain("段落 3");
    expect(html).toContain("segment_repair");
    expect(html).toContain("SEGMENT_REPAIR_FAILED");
    expect(html).toContain("required fields are invalid");
    expect(html).toContain("id=\"task-task-failed\"");
  });

  it("should expose explicit label mappings for all supported source/category values", () => {
    expect(REVIEW_REGENERATE_SOURCE_LABELS).toEqual({
      manual_review: "单条重生",
      manual_review_batch: "批量重生",
      manual_review_bulk_pending: "全量待复核重生",
    });
    expect(REVIEW_REGENERATE_CATEGORY_LABELS).toEqual({
      manual_review_regenerate: "重生任务",
      script_failure: "失败任务",
    });
  });

  it("should render all supported source/category labels", () => {
    const html = renderToStaticMarkup(
      <ReviewRegenerateTaskList
        tasks={[
          buildTask({
            id: "task-source-manual-review",
            source: "manual_review",
            category: "manual_review_regenerate",
          }),
          buildTask({
            id: "task-source-manual-review-batch",
            source: "manual_review_batch",
            category: "manual_review_regenerate",
          }),
          buildTask({
            id: "task-source-manual-review-bulk-pending",
            source: "manual_review_bulk_pending",
            category: "manual_review_regenerate",
          }),
          buildTask({
            id: "task-source-system-record",
            source: null,
            category: "script_failure",
          }),
        ]}
        loading={false}
      />
    );

    expect(html).toContain("单条重生");
    expect(html).toContain("批量重生");
    expect(html).toContain("全量待复核重生");
    expect(html).toContain("系统记录");
    expect(html).toContain("重生任务");
    expect(html).toContain("失败任务");
  });
});

describe("toRegenerateTask", () => {
  const buildTaskPayload = (
    overrides: Record<string, unknown> = {}
  ): Parameters<typeof toRegenerateTask>[0] => {
    return {
      id: "task-script-failure-1",
      bookId: "book-1",
      taskType: "SCRIPT_GENERATION",
      status: "failed",
      progress: 95,
      message: "台本生成部分失败",
      errorMessage: "台本生成部分失败：1/3 个段落未生成成功",
      createdAt: "2026-04-15T06:40:00.000Z",
      updatedAt: "2026-04-15T06:42:45.000Z",
      completedAt: "2026-04-15T06:42:45.000Z",
      metadata: {
        failedSegmentDetails: [
          {
            segmentId: "seg-3",
            orderIndex: 2,
            stage: "segment_repair",
            errorCode: "SEGMENT_REPAIR_FAILED",
            message: "Invalid repair payload line: required fields are invalid",
          },
        ],
        failedSegmentIds: ["seg-3"],
      },
      ...overrides,
    };
  };

  it("should include failed script generation tasks and keep source semantics separate from category", () => {
    const task = toRegenerateTask(
      buildTaskPayload({
        metadata: {
          source: "manual_review_batch",
          failedSegmentDetails: [
            {
              segmentId: "seg-3",
              orderIndex: 2,
              stage: "segment_repair",
              errorCode: "SEGMENT_REPAIR_FAILED",
              message:
                "Invalid repair payload line: required fields are invalid",
            },
          ],
          failedSegmentIds: ["seg-3"],
        },
      })
    );

    expect(task).not.toBeNull();
    expect(task?.source).toBe("manual_review_batch");
    expect(task?.category).toBe("script_failure");
    expect(task?.updatedAt).toBe("2026-04-15T06:42:45.000Z");
    expect(task?.segmentIds).toEqual(["seg-3"]);
    expect(task?.failureSummary).toEqual(
      expect.objectContaining({
        segmentId: "seg-3",
        orderIndex: 2,
        stage: "segment_repair",
        errorCode: "SEGMENT_REPAIR_FAILED",
      })
    );
    expect(task?.failureSummary?.message).toContain("required fields are invalid");
  });
});

describe("sortReviewRegenerateTasks", () => {
  it("should sort by updatedAt desc and use createdAt/id as deterministic tie-breakers", () => {
    const tasks: ReviewRegenerateTask[] = [
      buildTask({
        id: "task-c",
        updatedAt: "2026-04-15T09:00:00.000Z",
        createdAt: "2026-04-15T08:00:00.000Z",
      }),
      buildTask({
        id: "task-a",
        updatedAt: "2026-04-15T09:00:00.000Z",
        createdAt: "2026-04-15T08:00:00.000Z",
      }),
      buildTask({
        id: "task-d",
        updatedAt: "2026-04-15T09:00:00.000Z",
        createdAt: "2026-04-15T08:30:00.000Z",
      }),
      buildTask({
        id: "task-b",
        updatedAt: "2026-04-15T08:50:00.000Z",
        createdAt: "2026-04-15T08:49:00.000Z",
      }),
    ];

    const sorted = sortReviewRegenerateTasks(tasks);
    expect(sorted.map((task) => task.id)).toEqual([
      "task-d",
      "task-a",
      "task-c",
      "task-b",
    ]);
  });
});
