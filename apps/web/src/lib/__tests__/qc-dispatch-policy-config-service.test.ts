// 一旦我被更新，请更新我的开头注释
// input: 策略配置中心服务依赖 mock
// output: 三级策略合并/审计与回滚行为断言
// pos: 服务层单元测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    book: {
      findUnique: jest.fn(),
    },
    qcDispatchPolicyConfig: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    qcDispatchPolicyRevision: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import {
  parseDispatchPolicyConfigPayload,
  parseRollbackDispatchPolicyPayload,
  resolveDispatchPolicyForBook,
  upsertDispatchPolicyConfig,
  rollbackDispatchPolicyConfig,
} from "@/lib/qc-dispatch-policy-config-service";

const mockFindBook = (prisma as any).book.findUnique as jest.Mock;
const mockFindManyConfig = (prisma as any).qcDispatchPolicyConfig.findMany as jest.Mock;
const mockFindUniqueConfig = (prisma as any).qcDispatchPolicyConfig.findUnique as jest.Mock;
const mockUpsertConfig = (prisma as any).qcDispatchPolicyConfig.upsert as jest.Mock;
const mockUpdateConfig = (prisma as any).qcDispatchPolicyConfig.update as jest.Mock;
const mockCreateRevision = (prisma as any).qcDispatchPolicyRevision.create as jest.Mock;
const mockTransaction = (prisma as any).$transaction as jest.Mock;

const bookRecord = {
  id: "book-1",
  tenantId: "tenant-1",
  projectId: "project-1",
  metadata: {},
};

describe("qc-dispatch-policy-config-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindBook.mockResolvedValue(bookRecord);
    mockTransaction.mockImplementation(async (runner: any) => {
      return runner({
        qcDispatchPolicyConfig: {
          upsert: mockUpsertConfig,
          update: mockUpdateConfig,
        },
        qcDispatchPolicyRevision: {
          create: mockCreateRevision,
        },
      });
    });
  });

  it("should resolve merged policy from tenant/project/book with override", async () => {
    mockFindManyConfig.mockResolvedValueOnce([
      {
        id: "cfg-tenant",
        scopeType: "tenant",
        scopeKey: "tenant-1",
        policy: {
          autoCreatePendingOnReject: false,
          maxAutoRejectedCount: 1,
        },
        isActive: true,
        rolloutPercentage: 100,
        version: 2,
        updatedAt: new Date("2026-03-05T11:00:00.000Z"),
        lastChangeNote: null,
        updatedBy: null,
      },
      {
        id: "cfg-project",
        scopeType: "project",
        scopeKey: "project-1",
        policy: {
          autoCreatePendingOnReject: true,
        },
        isActive: true,
        rolloutPercentage: 100,
        version: 3,
        updatedAt: new Date("2026-03-05T11:05:00.000Z"),
        lastChangeNote: null,
        updatedBy: null,
      },
      {
        id: "cfg-book",
        scopeType: "book",
        scopeKey: "book-1",
        policy: {
          issueTypePolicies: {
            FAST_GATE: {
              maxAutoRejectedCount: 3,
            },
          },
        },
        isActive: true,
        rolloutPercentage: 100,
        version: 4,
        updatedAt: new Date("2026-03-05T11:10:00.000Z"),
        lastChangeNote: null,
        updatedBy: null,
      },
    ]);

    const result = await resolveDispatchPolicyForBook({
      bookId: "book-1",
      overridePolicy: {
        maxAutoRejectedCount: 6,
      },
    });

    expect(result.context).toEqual({
      bookId: "book-1",
      tenantId: "tenant-1",
      projectId: "project-1",
    });
    expect(result.resolvedPolicy).toMatchObject({
      autoCreatePendingOnReject: true,
      maxAutoRejectedCount: 6,
      issueTypePolicies: {
        FAST_GATE: {
          maxAutoRejectedCount: 3,
        },
      },
    });
    expect(result.runtimeScopes.map((scope) => scope.scopeType)).toEqual([
      "tenant",
      "project",
      "book",
    ]);
    expect(result.runtimeScopes.every((scope) => scope.applied)).toBe(true);
  });

  it("should parse payload and reject invalid scope", () => {
    expect(() =>
      parseDispatchPolicyConfigPayload({
        scopeType: "invalid",
        policy: {
          autoCreatePendingOnReject: true,
        },
      })
    ).toThrow(ValidationError);
  });

  it("should upsert config and write revision", async () => {
    mockFindUniqueConfig.mockResolvedValueOnce(null);
    mockUpsertConfig.mockResolvedValueOnce({
      id: "cfg-book",
      version: 1,
      scopeType: "book",
      scopeKey: "book-1",
    });
    mockCreateRevision.mockResolvedValueOnce({});
    mockFindManyConfig.mockResolvedValueOnce([
      {
        id: "cfg-book",
        scopeType: "book",
        scopeKey: "book-1",
        policy: {
          autoCreatePendingOnReject: false,
          maxAutoRejectedCount: 4,
        },
        isActive: true,
        rolloutPercentage: 100,
        version: 1,
        updatedAt: new Date("2026-03-05T12:00:00.000Z"),
        lastChangeNote: "first",
        updatedBy: "ops",
      },
    ]);

    const result = await upsertDispatchPolicyConfig({
      bookId: "book-1",
      payload: {
        scopeType: "book",
        policy: {
          autoCreatePendingOnReject: false,
          maxAutoRejectedCount: 4,
        },
        updatedBy: "ops",
        changeNote: "first",
      },
    });

    expect(mockUpsertConfig).toHaveBeenCalledWith({
      where: {
        scopeType_scopeKey: {
          scopeType: "book",
          scopeKey: "book-1",
        },
      },
      create: expect.objectContaining({
        scopeType: "book",
        scopeKey: "book-1",
        version: 1,
      }),
      update: expect.objectContaining({
        version: 1,
      }),
      select: expect.any(Object),
    });
    expect(mockCreateRevision).toHaveBeenCalledWith({
      data: expect.objectContaining({
        configId: "cfg-book",
        version: 1,
        changeType: "create",
      }),
    });
    expect(result).toMatchObject({
      scopeType: "book",
      scopeKey: "book-1",
      configId: "cfg-book",
      version: 1,
      policy: {
        autoCreatePendingOnReject: false,
        maxAutoRejectedCount: 4,
      },
    });
  });

  it("should rollback config to target version", async () => {
    mockFindUniqueConfig.mockResolvedValueOnce({
      id: "cfg-book",
      version: 5,
      scopeType: "book",
      scopeKey: "book-1",
      revisions: [
        {
          id: "rev-2",
          version: 2,
          snapshot: {
            scopeType: "book",
            scopeKey: "book-1",
            policy: {
              autoCreatePendingOnReject: true,
              maxAutoRejectedCount: 2,
            },
            isActive: true,
            rolloutPercentage: 100,
          },
        },
      ],
    });
    mockUpdateConfig.mockResolvedValueOnce({});
    mockCreateRevision.mockResolvedValueOnce({});
    mockFindManyConfig.mockResolvedValueOnce([
      {
        id: "cfg-book",
        scopeType: "book",
        scopeKey: "book-1",
        policy: {
          autoCreatePendingOnReject: true,
          maxAutoRejectedCount: 2,
        },
        isActive: true,
        rolloutPercentage: 100,
        version: 6,
        updatedAt: new Date("2026-03-05T13:00:00.000Z"),
        lastChangeNote: "rollback",
        updatedBy: "ops",
      },
    ]);

    const result = await rollbackDispatchPolicyConfig({
      bookId: "book-1",
      payload: {
        scopeType: "book",
        targetVersion: 2,
        updatedBy: "ops",
      },
    });

    expect(mockUpdateConfig).toHaveBeenCalledWith({
      where: {
        id: "cfg-book",
      },
      data: expect.objectContaining({
        version: 6,
      }),
    });
    expect(mockCreateRevision).toHaveBeenCalledWith({
      data: expect.objectContaining({
        configId: "cfg-book",
        version: 6,
        changeType: "rollback",
      }),
    });
    expect(result).toMatchObject({
      scopeType: "book",
      scopeKey: "book-1",
      rolledBackToVersion: 2,
      version: 6,
      policy: {
        autoCreatePendingOnReject: true,
        maxAutoRejectedCount: 2,
      },
    });
  });

  it("should parse rollback payload", () => {
    const payload = parseRollbackDispatchPolicyPayload({
      targetVersion: 3,
      scopeType: "project",
      scopeId: "project-1",
    });

    expect(payload).toEqual({
      scopeType: "project",
      scopeId: "project-1",
      targetVersion: 3,
      updatedBy: undefined,
      changeNote: undefined,
      expectedVersion: undefined,
    });
  });
});
