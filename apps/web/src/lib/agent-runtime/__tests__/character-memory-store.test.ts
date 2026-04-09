import type { MemoryPatch } from "../context";
import {
  applyCharacterMemoryPatch,
  createBootstrapCharacterMemorySnapshot,
} from "../runtime/character-memory/store";

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
});
