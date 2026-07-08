// 一旦我被更新，请更新我的开头注释
// input: 人工复核行数据/运行时工作流记录
// output: 回填后的 issueDetail 预览元信息
// pos: 人工复核运行时回填
import prisma from "@/lib/prisma";
import { SCRIPT_VALIDATION_ISSUE_TYPE } from "@/lib/script-validation-review";

type ReviewRow = {
  issueType: string;
  segmentId: string | null;
  issueDetail: unknown;
};

interface RuntimeRecoveredPayload {
  rawResponse: string | null;
  structuredResult: Record<string, unknown> | null;
}

const RAW_RESPONSE_UNAVAILABLE_REASON =
  "当前任务运行时未持久化原始响应，已从运行时草稿回填原始生成结果。";

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
};

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const hasRawResponse = (value: unknown) => asString(value).length > 0;

const hasStructuredResult = (value: unknown) => Boolean(asRecord(value));

const buildTaskSegmentKey = (taskId: string, segmentId: string) =>
  `${taskId}::${segmentId}`;

const toRecoveredStructuredResult = (
  draft: unknown
): Record<string, unknown> | null => {
  const record = asRecord(draft);
  if (!Array.isArray(record?.lines)) {
    return null;
  }

  const segmentId = asString(record.segmentId);
  const createdAt = asString(record.createdAt);

  return {
    ...(segmentId ? { segmentId } : {}),
    ...(createdAt ? { createdAt } : {}),
    lines: cloneJson(record.lines),
  };
};

const extractRecoveredPayload = (value: unknown): RuntimeRecoveredPayload | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const draftRecord = asRecord(record.segmentScriptDraft);
  const repairedDraftRecord = asRecord(record.repairedDraft);
  const failedArtifactRecord = asRecord(record.failedArtifact);
  const rawResponse =
    asString(record.rawResponse) ||
    asString(draftRecord?.rawResponse) ||
    asString(repairedDraftRecord?.rawResponse) ||
    asString(failedArtifactRecord?.rawResponse) ||
    "";
  const structuredResult =
    toRecoveredStructuredResult(record.structuredResult) ||
    toRecoveredStructuredResult(record.segmentScriptDraft) ||
    toRecoveredStructuredResult(record.repairedDraft) ||
    toRecoveredStructuredResult(failedArtifactRecord?.structuredResult);

  if (!rawResponse && !structuredResult) {
    return null;
  }

  return {
    rawResponse: rawResponse || null,
    structuredResult,
  };
};

const collectRecoveryTargets = (rows: ReviewRow[]) => {
  const taskIds = new Set<string>();
  const targets = new Set<string>();

  for (const row of rows) {
    if (row.issueType !== SCRIPT_VALIDATION_ISSUE_TYPE || !row.segmentId) {
      continue;
    }

    const detail = asRecord(row.issueDetail);
    const taskId = asString(detail?.taskId);
    if (!taskId) {
      continue;
    }

    const needsRawResponse = !hasRawResponse(detail?.rawResponse);
    const needsStructuredResult = !hasStructuredResult(detail?.structuredResult);
    if (!needsRawResponse && !needsStructuredResult) {
      continue;
    }

    taskIds.add(taskId);
    targets.add(buildTaskSegmentKey(taskId, row.segmentId));
  }

  return {
    taskIds: Array.from(taskIds),
    targets,
  };
};

const loadRuntimeRecoveryMap = async (rows: ReviewRow[]) => {
  const { taskIds, targets } = collectRecoveryTargets(rows);
  if (taskIds.length === 0) {
    return new Map<string, RuntimeRecoveredPayload>();
  }

  const workflows = await (prisma as any).workflowRun.findMany({
    where: {
      processingTaskId: {
        in: taskIds,
      },
    },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    include: {
      stageRuns: {
        where: {
          stageId: {
            in: ["segment_scripting", "segment_repair"],
          },
        },
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        include: {
          agentRuns: {
            where: {
              OR: [
                {
                  agentId: "script-generation-agent",
                  status: "completed",
                },
                {
                  agentId: "repair-agent",
                  status: {
                    in: ["completed", "failed"],
                  },
                },
              ],
            },
            orderBy: [
              { completedAt: "desc" },
              { startedAt: "desc" },
              { id: "desc" },
            ],
          },
        },
      },
    },
  });

  const recoveryMap = new Map<string, RuntimeRecoveredPayload>();

  for (const workflow of workflows as Array<{
    processingTaskId?: string | null;
    stageRuns?: Array<{
      agentRuns?: Array<{
        inputSummary?: unknown;
        outputSummary?: unknown;
      }>;
    }>;
  }>) {
    const taskId = asString(workflow.processingTaskId);
    if (!taskId) {
      continue;
    }

    for (const stageRun of workflow.stageRuns || []) {
      for (const agentRun of stageRun.agentRuns || []) {
        const segmentId = asString(asRecord(agentRun.inputSummary)?.segmentId);
        if (!segmentId) {
          continue;
        }

        const key = buildTaskSegmentKey(taskId, segmentId);
        if (!targets.has(key) || recoveryMap.has(key)) {
          continue;
        }

        const recoveredPayload = extractRecoveredPayload(agentRun.outputSummary);
        if (!recoveredPayload) {
          continue;
        }

        recoveryMap.set(key, recoveredPayload);
      }
    }
  }

  return recoveryMap;
};

export const hydrateManualReviewRuntimeDetails = async <TRow extends ReviewRow>(
  rows: TRow[]
): Promise<TRow[]> => {
  const recoveryMap = await loadRuntimeRecoveryMap(rows);
  if (recoveryMap.size === 0) {
    return rows;
  }

  return rows.map((row) => {
    if (row.issueType !== SCRIPT_VALIDATION_ISSUE_TYPE || !row.segmentId) {
      return row;
    }

    const detail = asRecord(row.issueDetail);
    const taskId = asString(detail?.taskId);
    if (!taskId) {
      return row;
    }

    const recoveredPayload = recoveryMap.get(buildTaskSegmentKey(taskId, row.segmentId));
    if (!recoveredPayload) {
      return row;
    }

    const nextDetail = {
      ...(detail || {}),
    } as Record<string, unknown>;
    let mutated = false;

    if (!hasStructuredResult(detail?.structuredResult) && recoveredPayload.structuredResult) {
      nextDetail.structuredResult = recoveredPayload.structuredResult;
      mutated = true;
    }

    if (!hasRawResponse(detail?.rawResponse) && recoveredPayload.rawResponse) {
      nextDetail.rawResponse = recoveredPayload.rawResponse;
      mutated = true;
    }

    if (
      !hasRawResponse(detail?.rawResponse) &&
      !recoveredPayload.rawResponse &&
      recoveredPayload.structuredResult
    ) {
      nextDetail.rawResponseUnavailableReason = RAW_RESPONSE_UNAVAILABLE_REASON;
      mutated = true;
    }

    if (!mutated) {
      return row;
    }

    return {
      ...row,
      issueDetail: nextDetail,
    };
  });
};
