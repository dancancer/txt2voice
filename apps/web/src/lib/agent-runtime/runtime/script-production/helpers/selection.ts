import type {
  ScriptProductionBookSegment,
  ScriptProductionWorkflowMode,
} from "../shared-types";

export const resolveWorkflowSegments = (params: {
  mode: ScriptProductionWorkflowMode;
  allSegments: ScriptProductionBookSegment[];
  segmentIds?: string[];
  startFromSegmentId?: string | null;
  startFromOrderIndex?: number | null;
  limitToSegments?: number;
  resolvePartial: (params: {
    segments: any[];
    startFromSegmentId?: string | null;
    startFromOrderIndex?: number | null;
    limitToSegments?: number;
  }) => any[];
}): ScriptProductionBookSegment[] => {
  if (params.mode === "partial") {
    return params.resolvePartial({
      segments: params.allSegments,
      startFromSegmentId: params.startFromSegmentId,
      startFromOrderIndex: params.startFromOrderIndex,
      limitToSegments: params.limitToSegments,
    }) as ScriptProductionBookSegment[];
  }

  if (
    params.mode === "regenerate" &&
    Array.isArray(params.segmentIds) &&
    params.segmentIds.length > 0
  ) {
    const selectedIds = new Set(params.segmentIds);
    return params.allSegments.filter((segment) => selectedIds.has(segment.id));
  }

  return params.allSegments;
};
