// 一旦我被更新，请更新我的开头注释
// input: review 重生任务列表 props
// output: 重生任务状态渲染断言
// pos: review 重生任务组件测试
import { renderToStaticMarkup } from "react-dom/server.node";
import { ReviewRegenerateTaskList } from "../ReviewRegenerateTaskList";
import type { ReviewRegenerateTask } from "../../models/types";

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
  source: "manual_review_batch",
  targetCount: 3,
  ...overrides,
});

describe("ReviewRegenerateTaskList", () => {
  it("should render empty state when no regenerate tasks exist", () => {
    const html = renderToStaticMarkup(
      <ReviewRegenerateTaskList tasks={[]} loading={false} />
    );

    expect(html).toContain("最近重生任务");
    expect(html).toContain("当前还没有人工复核触发的重生任务");
  });

  it("should render processing task progress and source label", () => {
    const html = renderToStaticMarkup(
      <ReviewRegenerateTaskList tasks={[buildTask()]} loading={false} />
    );

    expect(html).toContain("最近重生任务");
    expect(html).toContain("台本生成");
    expect(html).toContain("执行中");
    expect(html).toContain("批量重生");
    expect(html).toContain("42%");
    expect(html).toContain("目标 3 条");
    expect(html).toContain("段落重新生成进行中");
  });

  it("should render completed and failed tasks", () => {
    const html = renderToStaticMarkup(
      <ReviewRegenerateTaskList
        tasks={[
          buildTask({
            id: "task-completed",
            status: "completed",
            progress: 100,
            message: "段落重新生成完成",
            completedAt: "2026-03-22T06:05:00.000Z",
            source: "manual_review",
            targetCount: 1,
          }),
          buildTask({
            id: "task-failed",
            status: "failed",
            progress: 90,
            message: "台本生成部分失败",
            errorMessage: "LLM服务连接失败",
            source: "manual_review_batch",
          }),
        ]}
        loading={false}
      />
    );

    expect(html).toContain("单条重生");
    expect(html).toContain("已完成");
    expect(html).toContain("段落重新生成完成");
    expect(html).toContain("失败");
    expect(html).toContain("LLM服务连接失败");
  });
});
