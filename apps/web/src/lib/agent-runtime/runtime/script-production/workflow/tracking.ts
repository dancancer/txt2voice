import type { ScriptProductionRuntimeStore } from "../../script-production-runtime-store";
import type {
  ScriptProductionExecutionState,
  WorkflowNow,
  WorkflowTrackingAdapters,
} from "./types";

export const createWorkflowTrackingAdapters = ({
  runtimeStore,
  now,
  state,
}: {
  runtimeStore: ScriptProductionRuntimeStore;
  now: WorkflowNow;
  state: ScriptProductionExecutionState;
}): WorkflowTrackingAdapters => ({
  createTrackedStageRun: async (record) => {
    state.stageRunCount += 1;
    await runtimeStore.createStageRun({
      ...record,
      startedAt: now(),
    });
  },

  updateTrackedStageRun: async (record) => {
    await runtimeStore.updateStageRun({
      ...record,
      completedAt: now(),
    });
  },

  createTrackedAgentRun: async (record) => {
    await runtimeStore.createAgentRun({
      ...record,
      startedAt: now(),
    });
  },

  updateTrackedAgentRun: async (record) => {
    await runtimeStore.updateAgentRun({
      ...record,
      completedAt: record.completedAt ?? now(),
    });
  },

  appendTrackedTrace: async (event) => {
    state.traceEventCount += 1;
    await runtimeStore.appendTrace(event);
  },
});

export const createToolCallAdapters = ({
  runtimeStore,
  now,
}: {
  runtimeStore: ScriptProductionRuntimeStore;
  now: WorkflowNow;
}) => ({
  createToolCall: async (record: any) => {
    await runtimeStore.createToolCall({
      ...record,
      createdAt: record.createdAt ?? now(),
    });
  },
  updateToolCall: async (record: any) => {
    await runtimeStore.updateToolCall({
      ...record,
      completedAt: record.completedAt ?? now(),
    });
  },
});
