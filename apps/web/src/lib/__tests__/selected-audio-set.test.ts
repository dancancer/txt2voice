import {
  buildSelectedAudioSet,
  computeAudioArtifactHash,
} from "@/lib/auto-pipeline/selected-audio-set";

const at = (iso: string): Date => new Date(iso);

const audio = (overrides: Partial<Parameters<typeof buildSelectedAudioSet>[0]["audioFiles"][number]>) => ({
  id: "audio-1",
  sentenceId: "sentence-1",
  status: "completed",
  attemptNo: 1,
  createdAt: at("2026-01-01T00:00:00.000Z"),
  filePath: "/audio/a.mp3",
  fileSize: 1000,
  duration: 2.5,
  format: "mp3",
  ...overrides,
});

describe("selected audio set", () => {
  it("selects one completed audio per target sentence by attempt, creation time, then id", () => {
    const result = buildSelectedAudioSet({
      targetSentenceIds: ["sentence-1", "sentence-2"],
      audioFiles: [
        audio({ id: "audio-old", sentenceId: "sentence-1", attemptNo: 1 }),
        audio({ id: "audio-latest-attempt", sentenceId: "sentence-1", attemptNo: 3 }),
        audio({
          id: "audio-newer",
          sentenceId: "sentence-2",
          attemptNo: 2,
          createdAt: at("2026-01-02T00:00:00.000Z"),
        }),
        audio({
          id: "audio-stable-z",
          sentenceId: "sentence-2",
          attemptNo: 2,
          createdAt: at("2026-01-02T00:00:00.000Z"),
        }),
        audio({
          id: "audio-pending",
          sentenceId: "sentence-1",
          status: "pending",
          attemptNo: 10,
        }),
      ],
    });

    expect(result.selectedAudioFileIds).toEqual([
      "audio-latest-attempt",
      "audio-stable-z",
    ]);
    expect(result.selectedBySentenceId).toEqual({
      "sentence-1": "audio-latest-attempt",
      "sentence-2": "audio-stable-z",
    });
    expect(result.missingSentenceIds).toEqual([]);
    expect(result.selectedCount).toBe(2);
    expect(result.missingCount).toBe(0);
  });

  it("reports missing target sentences and includes missing state in the hash", () => {
    const complete = buildSelectedAudioSet({
      targetSentenceIds: ["sentence-1"],
      audioFiles: [audio({ id: "audio-1", sentenceId: "sentence-1" })],
    });
    const missing = buildSelectedAudioSet({
      targetSentenceIds: ["sentence-1", "sentence-2"],
      audioFiles: [audio({ id: "audio-1", sentenceId: "sentence-1" })],
    });

    expect(missing.missingSentenceIds).toEqual(["sentence-2"]);
    expect(missing.missingCount).toBe(1);
    expect(missing.selectedAudioSetHash).not.toBe(complete.selectedAudioSetHash);
  });

  it("changes hash when target sentence order changes", () => {
    const first = buildSelectedAudioSet({
      targetSentenceIds: ["sentence-1", "sentence-2"],
      audioFiles: [
        audio({ id: "audio-1", sentenceId: "sentence-1" }),
        audio({ id: "audio-2", sentenceId: "sentence-2" }),
      ],
    });
    const second = buildSelectedAudioSet({
      targetSentenceIds: ["sentence-2", "sentence-1"],
      audioFiles: [
        audio({ id: "audio-1", sentenceId: "sentence-1" }),
        audio({ id: "audio-2", sentenceId: "sentence-2" }),
      ],
    });

    expect(first.targetSentenceIdsHash).not.toBe(second.targetSentenceIdsHash);
    expect(first.selectedAudioSetHash).not.toBe(second.selectedAudioSetHash);
  });

  it("does not change hash when quality updates mutate AudioFile.updatedAt", () => {
    const beforeQuality = buildSelectedAudioSet({
      targetSentenceIds: ["sentence-1"],
      audioFiles: [
        audio({
          id: "audio-1",
          updatedAt: at("2026-01-01T00:00:00.000Z"),
        } as any),
      ],
    });
    const afterQuality = buildSelectedAudioSet({
      targetSentenceIds: ["sentence-1"],
      audioFiles: [
        audio({
          id: "audio-1",
          updatedAt: at("2026-01-05T00:00:00.000Z"),
        } as any),
      ],
    });

    expect(afterQuality.selectedAudioSetHash).toBe(
      beforeQuality.selectedAudioSetHash
    );
  });

  it("computes artifact hash from immutable generated audio fields", () => {
    expect(
      computeAudioArtifactHash({
        filePath: "/audio/a.mp3",
        fileSize: 1000,
        duration: 2.5,
        format: "mp3",
        createdAt: at("2026-01-01T00:00:00.000Z"),
      })
    ).toBe(
      computeAudioArtifactHash({
        filePath: "/audio/a.mp3",
        fileSize: BigInt(1000),
        duration: "2.5",
        format: "mp3",
        createdAt: "2026-01-01T00:00:00.000Z",
      })
    );
  });
});
