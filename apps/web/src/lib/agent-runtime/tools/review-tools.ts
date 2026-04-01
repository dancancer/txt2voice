import { syncRuntimeManualReviewItems } from "../runtime/script-production/manual-review-sync";
import type { RuntimeToolContract } from "./contracts";

export const SYNC_MANUAL_REVIEW_ITEMS_TOOL: RuntimeToolContract = {
  name: "sync-manual-review-items",
  kind: "task",
  sideEffect: true,
  inputSchemaRef: "tool.sync-manual-review-items.input.v1",
  outputSchemaRef: "tool.sync-manual-review-items.output.v1",
};

export interface SyncManualReviewItemsInput {
  taskId?: string;
  bookId: string;
  failures: Parameters<typeof syncRuntimeManualReviewItems>[0]["failures"];
  processedSegmentIds: string[];
  failedSegmentIds: string[];
}

export interface ReviewTools {
  syncManualReviewItems: (
    input: SyncManualReviewItemsInput
  ) => ReturnType<typeof syncRuntimeManualReviewItems>;
}

export const createReviewTools = (): ReviewTools => ({
  syncManualReviewItems: async (input) => syncRuntimeManualReviewItems(input),
});
