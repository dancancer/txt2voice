import type { MemoryPatch } from "../context";
import {
  applyCharacterMemoryPatch,
  createBootstrapCharacterMemorySnapshot,
} from "../runtime/character-memory/store";
import { mapCharacterMemoryToCandidates } from "../runtime/script-production/storage/character-utils";

describe("character memory store", () => {
  it("bootstraps snapshot from character profiles with version 1", () => {
    const snapshot = createBootstrapCharacterMemorySnapshot([
      {
        id: "char-ning",
        canonicalName: "宁尘",
        aliases: [{ alias: "宁公子" }],
      },
    ]);

    expect(snapshot.version).toBe(1);
    expect(snapshot.source).toBe("bootstrap");
    expect(snapshot.status).toBe("ready");
    expect(snapshot.canonicalIdentities).toEqual([
      {
        id: "char-ning",
        name: "宁尘",
      },
    ]);
    expect(snapshot.derivedMaps.canonicalNameByAlias).toEqual({
      宁公子: "宁尘",
    });
  });

  it("increments version and remaps patch buckets onto existing canonical identity", () => {
    const snapshot = createBootstrapCharacterMemorySnapshot([
      {
        id: "char-ning",
        canonicalName: "宁尘",
        aliases: [{ alias: "宁公子" }],
        characteristics: {
          importance: "secondary",
        },
      },
    ]);
    const patch: MemoryPatch = {
      canonicalIdentities: [
        {
          id: "llm-ning",
          name: "宁尘",
        },
      ],
      aliasEvidence: [
        { alias: "宁少", canonicalId: "llm-ning", source: "llm" },
        { alias: "宁少", canonicalId: "llm-ning", source: "llm" },
      ],
      assertedFacts: {
        "llm-ning": {
          importance: "main",
        },
      },
      inferredHints: {
        "llm-ning": {
          dialogueStyle: "冷静",
        },
      },
    };

    const nextSnapshot = applyCharacterMemoryPatch({
      snapshot,
      patch,
      source: "discovery_refresh",
    });

    expect(nextSnapshot.version).toBe(2);
    expect(nextSnapshot.source).toBe("discovery_refresh");
    expect(nextSnapshot.canonicalIdentities).toEqual([
      {
        id: "char-ning",
        name: "宁尘",
      },
    ]);
    expect(nextSnapshot.aliasEvidence).toEqual(
      expect.arrayContaining([
        { alias: "宁公子", canonicalId: "char-ning", source: "profile:char-ning" },
        { alias: "宁少", canonicalId: "char-ning", source: "llm" },
      ])
    );
    expect(
      nextSnapshot.aliasEvidence.filter(
        (entry) =>
          entry.alias === "宁少" &&
          entry.canonicalId === "char-ning" &&
          entry.source === "llm"
      )
    ).toHaveLength(1);
    expect(nextSnapshot.assertedFacts).toEqual({
      "char-ning": {
        importance: "main",
      },
    });
    expect(nextSnapshot.inferredHints).toEqual({
      "char-ning": {
        dialogueStyle: "冷静",
      },
    });
    expect(nextSnapshot.derivedMaps.canonicalNameByAlias).toEqual({
      宁公子: "宁尘",
      宁少: "宁尘",
    });
  });

  it("exposes a dedicated discovery refresh snapshot builder with refresh-aligned diagnostics", () => {
    const store = require("../runtime/character-memory/store") as {
      createDiscoveryRefreshCharacterMemorySnapshot?: (
        profiles: Array<{
          id: string;
          canonicalName: string;
          aliases: Array<{ alias: string }>;
        }>,
        options?: {
          version?: number;
          now?: () => Date;
        }
      ) => {
        version: number;
        source: string;
        diagnostics: {
          discoveryRunCount: number;
          sampleCoverage: {
            strategy: string;
          };
          lastDiscoveryAt?: string;
        };
      };
    };

    expect(typeof store.createDiscoveryRefreshCharacterMemorySnapshot).toBe(
      "function"
    );

    const snapshot = store.createDiscoveryRefreshCharacterMemorySnapshot!(
      [
        {
          id: "char-ning",
          canonicalName: "宁尘",
          aliases: [{ alias: "宁公子" }],
        },
      ],
      {
        version: 3,
        now: () => new Date("2026-04-11T08:00:00.000Z"),
      }
    );

    expect(snapshot.version).toBe(3);
    expect(snapshot.source).toBe("discovery_refresh");
    expect(snapshot.diagnostics.discoveryRunCount).toBe(1);
    expect(snapshot.diagnostics.sampleCoverage.strategy).toBe("incremental");
    expect(snapshot.diagnostics.lastDiscoveryAt).toBe(
      "2026-04-11T08:00:00.000Z"
    );
  });

  it("normalizes Chinese gender labels into runtime candidate enums", () => {
    const candidates = mapCharacterMemoryToCandidates({
      canonicalIdentities: [
        { id: "char-1", name: "宁采臣" },
        { id: "char-2", name: "聂小倩" },
        { id: "char-3", name: "路人甲" },
      ],
      aliasEvidence: [],
      assertedFacts: {
        "char-1": { gender: "男" },
        "char-2": { gender: "女性" },
        "char-3": { gender: "未知种类" },
      },
      inferredHints: {},
    } as any);

    expect(candidates).toEqual([
      expect.objectContaining({ name: "宁采臣", gender: "male" }),
      expect.objectContaining({ name: "聂小倩", gender: "female" }),
      expect.objectContaining({ name: "路人甲", gender: "unknown" }),
    ]);
  });
});
