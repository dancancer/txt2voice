// 一旦我被更新，请更新我的开头注释
// input: 返工筛选参数/服务依赖 mock
// output: 质量返工服务行为断言
// pos: 服务层单元测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    manualReviewItem: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    processingTask: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/task-queue", () => ({
  enqueueAudioGenerationJob: jest.fn(),
}));

jest.mock("@/lib/processing-task-utils", () => ({
  mergeTaskData: jest.fn(),
}));

jest.mock("@/lib/qc-dispatch-policy-config-service", () => ({
  resolveDispatchPolicyForBook: jest.fn(),
}));

import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import { enqueueAudioGenerationJob } from "@/lib/task-queue";
import { mergeTaskData } from "@/lib/processing-task-utils";
import { resolveDispatchPolicyForBook } from "@/lib/qc-dispatch-policy-config-service";
import {
  parseQualityRetryPayload,
  retryQualityIssues,
} from "@/lib/qc-retry-service";

const mockFindManualItems = (prisma as any).manualReviewItem.findMany as jest.Mock;
const mockUpdateManualItem = (prisma as any).manualReviewItem.update as jest.Mock;
const mockFindActiveAudioTask = (prisma as any).processingTask.findFirst as jest.Mock;
const mockCreateTask = (prisma as any).processingTask.create as jest.Mock;
const mockUpdateTask = (prisma as any).processingTask.update as jest.Mock;
const mockEnqueueAudio = enqueueAudioGenerationJob as jest.MockedFunction<
  typeof enqueueAudioGenerationJob
>;
const mockMergeTaskData = mergeTaskData as jest.MockedFunction<typeof mergeTaskData>;
const mockResolveDispatchPolicyForBook =
  resolveDispatchPolicyForBook as jest.MockedFunction<
    typeof resolveDispatchPolicyForBook
  >;

const buildCandidate = (overrides: Record<string, unknown> = {}) => ({
  id: "review-1",
  sentenceId: "sentence-1",
  status: "pending",
  resolutionNote: null,
  issueDetail: {
    score: 66,
    reasons: ["pace_too_fast"],
  },
  priority: "normal",
  createdAt: new Date("2026-03-05T15:00:00.000Z"),
  qualityCheckResult: {
    score: 66,
  },
  ...overrides,
});

describe("qc-retry-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveDispatchPolicyForBook.mockResolvedValue({
      context: {
        bookId: "book-1",
        tenantId: "tenant-1",
        projectId: "project-1",
      },
      runtimeScopes: [
        {
          scopeType: "tenant",
          scopeKey: "tenant-1",
          configId: "cfg-tenant",
          version: 2,
          isActive: true,
          rolloutPercentage: 100,
          policy: {
            maxAutoRejectedCount: 1,
          },
          applied: true,
          appliedReason: "full_rollout",
          rolloutBucket: null,
        },
      ],
      resolvedPolicy: {
        autoCreatePendingOnReject: true,
        maxAutoRejectedCount: 1,
        issueTypePolicies: {
          FAST_GATE: {
            maxAutoRejectedCount: 3,
          },
        },
      },
    });
  });

  it("should parse payload with defaults", () => {
    const payload = parseQualityRetryPayload({
      issueType: "fast_gate",
      minScore: "50",
      maxScore: 80,
      provider: "voxcpm",
    });

    expect(payload).toMatchObject({
      issueTypes: ["FAST_GATE"],
      minScore: 50,
      maxScore: 80,
      includeRejected: false,
      limit: 100,
      provider: "voxcpm",
      autoMerge: false,
    });
  });

  it("should throw when score range is invalid", () => {
    expect(() =>
      parseQualityRetryPayload({
        minScore: 90,
        maxScore: 80,
      })
    ).toThrow(ValidationError);
  });

  it("should throw when dispatch policy is invalid", () => {
    expect(() =>
      parseQualityRetryPayload({
        dispatchPolicy: {
          maxAutoRejectedCount: -1,
        },
      })
    ).toThrow(ValidationError);
  });

  it("should enqueue batch retry and mark review items as reprocessing", async () => {
    mockFindActiveAudioTask.mockResolvedValueOnce(null);
    mockFindManualItems.mockResolvedValueOnce([
      buildCandidate(),
      buildCandidate({
        id: "review-2",
        sentenceId: "sentence-2",
        priority: "high",
        qualityCheckResult: {
          score: 62,
        },
      }),
      buildCandidate({
        id: "review-3",
        sentenceId: "sentence-2",
        qualityCheckResult: {
          score: 75,
        },
      }),
    ]);
    mockCreateTask.mockResolvedValueOnce({
      id: "task-qc-retry-1",
      status: "processing",
    });
    mockEnqueueAudio.mockResolvedValueOnce({
      jobId: "task-qc-retry-1",
      dedupeKey: "audio:book-1:batch",
      reused: false,
      state: "waiting",
    });
    mockUpdateManualItem.mockResolvedValue({});

    const result = await retryQualityIssues({
      bookId: "book-1",
      payload: {
        issueTypes: ["FAST_GATE"],
        minScore: 60,
        maxScore: 70,
        includeRejected: false,
        limit: 5,
        voiceProfileId: "voice-1",
        provider: "voxcpm",
        autoMerge: false,
        note: "批量返工",
      },
    });

    expect(mockResolveDispatchPolicyForBook).toHaveBeenCalledWith({
      bookId: "book-1",
      overridePolicy: undefined,
    });
    expect(mockCreateTask).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookId: "book-1",
        taskType: "AUDIO_GENERATION",
        totalItems: 2,
        taskData: expect.objectContaining({
          metadata: expect.objectContaining({
            autoCreatePendingOnReject: true,
            maxAutoRejectedCount: 1,
            dispatchPolicyContext: {
              bookId: "book-1",
              tenantId: "tenant-1",
              projectId: "project-1",
            },
          }),
        }),
      }),
    });
    expect(mockEnqueueAudio).toHaveBeenCalledWith({
      taskId: "task-qc-retry-1",
      bookId: "book-1",
      type: "batch",
      scriptSentenceIds: ["sentence-2", "sentence-1"],
      voiceProfileId: "voice-1",
      autoMerge: false,
      options: {
        provider: "voxcpm",
        skipExisting: false,
        overwriteExisting: true,
      },
    });
    expect(mockUpdateManualItem).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      retryTask: {
        taskId: "task-qc-retry-1",
        taskType: "AUDIO_GENERATION",
        status: "processing",
      },
      selectedReviewItemCount: 2,
      selectedSentenceCount: 2,
      selectedReviewItemIds: ["review-2", "review-1"],
      selectedSentenceIds: ["sentence-2", "sentence-1"],
      dispatchPolicy: {
        autoCreatePendingOnReject: true,
        maxAutoRejectedCount: 1,
      },
    });
  });

  it("should pass payload dispatch policy override to resolver", async () => {
    mockFindActiveAudioTask.mockResolvedValueOnce(null);
    mockFindManualItems.mockResolvedValueOnce([buildCandidate()]);
    mockCreateTask.mockResolvedValueOnce({
      id: "task-qc-retry-merge-policy",
      status: "processing",
    });
    mockEnqueueAudio.mockResolvedValueOnce({
      jobId: "task-qc-retry-merge-policy",
      dedupeKey: "audio:book-1:batch",
      reused: false,
      state: "waiting",
    });
    mockUpdateManualItem.mockResolvedValue({});

    await retryQualityIssues({
      bookId: "book-1",
      payload: {
        includeRejected: false,
        limit: 5,
        autoMerge: false,
        dispatchPolicy: {
          autoCreatePendingOnReject: false,
          issueTypePolicies: {
            FAST_GATE: {
              maxAutoRejectedCount: 2,
            },
          },
        },
      },
    });

    expect(mockResolveDispatchPolicyForBook).toHaveBeenCalledWith({
      bookId: "book-1",
      overridePolicy: {
        autoCreatePendingOnReject: false,
        issueTypePolicies: {
          FAST_GATE: {
            maxAutoRejectedCount: 2,
          },
        },
      },
    });
  });

  it("should reject when active audio task exists", async () => {
    mockFindActiveAudioTask.mockResolvedValueOnce({
      id: "task-active",
    });

    await expect(
      retryQualityIssues({
        bookId: "book-1",
        payload: {
          includeRejected: false,
          limit: 10,
          autoMerge: false,
        },
      })
    ).rejects.toThrow("当前存在执行中的音频任务");
  });

  it("should reject when no retry candidates matched", async () => {
    mockFindActiveAudioTask.mockResolvedValueOnce(null);
    mockFindManualItems.mockResolvedValueOnce([]);

    await expect(
      retryQualityIssues({
        bookId: "book-1",
        payload: {
          includeRejected: false,
          limit: 10,
          autoMerge: false,
        },
      })
    ).rejects.toThrow("未匹配到可返工的复核项");
  });

  it("should mark retry task failed when enqueue fails", async () => {
    mockFindActiveAudioTask.mockResolvedValueOnce(null);
    mockFindManualItems.mockResolvedValueOnce([buildCandidate()]);
    mockCreateTask.mockResolvedValueOnce({
      id: "task-qc-retry-2",
      status: "processing",
    });
    mockEnqueueAudio.mockRejectedValueOnce(new Error("queue down"));
    mockMergeTaskData.mockResolvedValueOnce({
      message: "质量返工任务入队失败",
    } as any);
    mockUpdateTask.mockResolvedValueOnce({});

    await expect(
      retryQualityIssues({
        bookId: "book-1",
        payload: {
          includeRejected: false,
          limit: 10,
          autoMerge: false,
        },
      })
    ).rejects.toThrow("queue down");

    expect(mockUpdateTask).toHaveBeenCalledWith({
      where: {
        id: "task-qc-retry-2",
      },
      data: expect.objectContaining({
        status: "failed",
        errorMessage: "queue down",
      }),
    });
  });
});
