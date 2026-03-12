// 一旦我被更新，请更新我的开头注释
// input: review 过滤条 props
// output: 推荐动作筛选渲染断言
// pos: review 过滤条测试
import { renderToStaticMarkup } from "react-dom/server.node";
import { ReviewFilterBar } from "../ReviewQueuePanel";

describe("ReviewFilterBar", () => {
  it("should render recommended action filter for script validation view", () => {
    const html = renderToStaticMarkup(
      <ReviewFilterBar
        status="pending"
        issueType="SCRIPT_VALIDATION"
        scriptSubtype="all"
        recommendedAction="regenerate"
        priority="all"
        issueTypeOptions={["SCRIPT_VALIDATION"]}
        scriptSubtypeOptions={[{ value: "COVERAGE", label: "覆盖率不足" }]}
        recommendedActionOptions={[
          { value: "regenerate", label: "重生" },
          { value: "approve", label: "通过" },
        ]}
        showScriptSubtypeFilter
        showRecommendedActionFilter
        onStatusChange={() => undefined}
        onIssueTypeChange={() => undefined}
        onScriptSubtypeChange={() => undefined}
        onRecommendedActionChange={() => undefined}
        onPriorityChange={() => undefined}
        onRefresh={() => undefined}
        onExport={() => undefined}
        refreshing={false}
      />
    );

    expect(html).toContain("grid-cols-1 gap-3 md:grid-cols-7");
    expect(html).toContain("regenerate");
  });
});
