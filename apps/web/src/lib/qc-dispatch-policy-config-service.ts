// 一旦我被更新，请更新我的开头注释
// input: 配置中心服务导入
// output: 统一导出的策略配置中心 API
// pos: 配置中心聚合入口
export {
  parseDispatchPolicyConfigPayload,
  parseRollbackDispatchPolicyPayload,
  parseDispatchPolicySettingsQuery,
} from "@/lib/qc-dispatch-policy-config/parsers";

export {
  resolveDispatchPolicyForBook,
  getDispatchPolicySettingsForBook,
} from "@/lib/qc-dispatch-policy-config/runtime";

export {
  upsertDispatchPolicyConfig,
  rollbackDispatchPolicyConfig,
} from "@/lib/qc-dispatch-policy-config/mutations";

export type {
  DispatchPolicyBookContext,
  DispatchPolicyResolutionResult,
  DispatchPolicyScopeRuntime,
  DispatchPolicyScopeState,
  DispatchPolicySettingsView,
  RollbackDispatchPolicyConfigPayload,
  UpsertDispatchPolicyConfigPayload,
} from "@/lib/qc-dispatch-policy-config/types";
