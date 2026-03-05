// 一旦我被更新，请更新我的开头注释
// input: 类型定义依赖
// output: dispatchPolicy 配置中心共享类型
// pos: 配置中心类型定义
import { QcDispatchPolicy, QcDispatchPolicyScopeType, ResolvedQcDispatchPolicy } from "@/lib/qc-dispatch-policy";

export const MAX_ROLLOUT_PERCENTAGE = 100;
export const DEFAULT_ROLLOUT_PERCENTAGE = 100;
export const DEFAULT_SCOPE_TYPE: QcDispatchPolicyScopeType = "book";
export const MAX_HISTORY_LIMIT = 50;

export interface DispatchPolicyBookContext {
  bookId: string;
  tenantId: string | null;
  projectId: string | null;
}

export interface DispatchPolicyScopeRuntime {
  scopeType: QcDispatchPolicyScopeType;
  scopeKey: string | null;
  configId: string | null;
  version: number | null;
  isActive: boolean;
  rolloutPercentage: number | null;
  policy: QcDispatchPolicy | null;
  applied: boolean;
  appliedReason: string;
  rolloutBucket: number | null;
}

export interface DispatchPolicyScopeState {
  scopeType: QcDispatchPolicyScopeType;
  scopeKey: string | null;
  config: {
    id: string;
    version: number;
    policy: QcDispatchPolicy;
    isActive: boolean;
    rolloutPercentage: number;
    updatedAt: Date;
    lastChangeNote: string | null;
    updatedBy: string | null;
  } | null;
  revisions: Array<{
    id: string;
    version: number;
    changeType: string;
    changedBy: string | null;
    changeNote: string | null;
    createdAt: Date;
  }>;
}

export interface DispatchPolicyResolutionResult {
  context: DispatchPolicyBookContext;
  resolvedPolicy: ResolvedQcDispatchPolicy;
  runtimeScopes: DispatchPolicyScopeRuntime[];
}

export interface DispatchPolicySettingsView {
  context: DispatchPolicyBookContext;
  resolvedPolicy: ResolvedQcDispatchPolicy;
  runtimeScopes: DispatchPolicyScopeRuntime[];
  scopeStates: DispatchPolicyScopeState[];
}

export interface UpsertDispatchPolicyConfigPayload {
  scopeType: QcDispatchPolicyScopeType;
  scopeId?: string;
  policy?: QcDispatchPolicy;
  isActive?: boolean;
  rolloutPercentage?: number;
  updatedBy?: string;
  changeNote?: string;
  expectedVersion?: number;
}

export interface RollbackDispatchPolicyConfigPayload {
  scopeType: QcDispatchPolicyScopeType;
  scopeId?: string;
  targetVersion: number;
  updatedBy?: string;
  changeNote?: string;
  expectedVersion?: number;
}

export interface DispatchPolicyScopeConfig {
  scopeType: QcDispatchPolicyScopeType;
  scopeKey: string;
  id: string;
  version: number;
  policy: QcDispatchPolicy;
  isActive: boolean;
  rolloutPercentage: number;
  updatedAt: Date;
  lastChangeNote: string | null;
  updatedBy: string | null;
}
