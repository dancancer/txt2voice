import { createFailureDetail } from "../script-production-runtime-helpers";
import { finalizeSegment } from "./finalize-segment";
import { resolveSegmentDraft } from "./resolve-segment-draft";
import { runSegmentValidationCycle } from "./run-segment-validation-cycle";
import type {
  RecursiveRunSingleSegment,
  RunSingleSegmentParams,
} from "./run-single-segment-types";
import type { SegmentRunResult } from "./shared-types";

export type { RunSingleSegmentParams } from "./run-single-segment-types";

export const runSingleSegment = async (
  params: RunSingleSegmentParams
): Promise<SegmentRunResult> => {
  const recurse: RecursiveRunSingleSegment = async (input) =>
    runSingleSegment({
      ...params,
      segment: input.segment,
      semanticRetryDepth: input.semanticRetryDepth,
      inputRefinementDepth: input.inputRefinementDepth,
      deferPersist: input.deferPersist,
    });

  const draftResolution = await resolveSegmentDraft(params, recurse);
  if (draftResolution.status !== "success") {
    return draftResolution;
  }

  if (!draftResolution.draft) {
    return {
      status: "failed",
      failure: createFailureDetail({
        segment: params.segment,
        stage: "segment_scripting",
        errorCode: "SEGMENT_SCRIPTING_EMPTY_DRAFT",
        message: "segment_scripting_empty_draft",
      }),
      counters: draftResolution.counters,
    };
  }

  const validationCycle = await runSegmentValidationCycle(
    params,
    draftResolution.draft,
    draftResolution.counters,
    recurse
  );
  if (validationCycle.status === "terminal") {
    return validationCycle.result;
  }
  if (validationCycle.status !== "success") {
    return validationCycle;
  }

  return finalizeSegment({
    context: params,
    draft: validationCycle.draft,
    validationReport: validationCycle.validationReport,
    counters: validationCycle.counters,
  });
};
