import fs from "fs";
import os from "os";
import path from "path";

import { saveAudioFile } from "@/lib/audio-generation/persistence/audio-file-store";

describe("audio file store", () => {
  const originalUploadDir = process.env.UPLOAD_DIR;

  afterEach(() => {
    if (originalUploadDir === undefined) {
      delete process.env.UPLOAD_DIR;
    } else {
      process.env.UPLOAD_DIR = originalUploadDir;
    }
  });

  it("records VoxCPM provider and backfills speaker reference audio", async () => {
    const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "audio-store-"));
    process.env.UPLOAD_DIR = uploadDir;

    const tx = {
      audioFile: {
        create: jest.fn().mockResolvedValue({
          id: "audio-1",
          duration: 1.2,
          fileSize: BigInt(3),
        }),
      },
      synthesisAttempt: {
        create: jest.fn().mockResolvedValue({ id: "attempt-1" }),
      },
      speakerEngineVariant: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prismaClient = {
      synthesisAttempt: {
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn(async (callback) => callback(tx)),
    } as any;

    await saveAudioFile({
      scriptSentence: {
        id: "sentence-1",
        bookId: "book-1",
        segmentId: "segment-1",
        chapterId: "chapter-1",
        text: "资料带来了吗？",
      },
      voiceProfile: {
        provider: "voxcpm",
        voiceId: "__voxcpm_default__",
      },
      ttsResponse: {
        audioBuffer: new Uint8Array([1, 2, 3]).buffer,
        duration: 1.2,
        metadata: {
          filename: "voxcpm2_reference.wav",
        },
      },
      request: {
        scriptSentenceId: "sentence-1",
        outputFormat: "mp3",
      },
      ttsRequest: {
        text: "资料带来了吗？",
        voice: {
          id: "__voxcpm_default__",
          name: "voxcpm2-default",
          displayName: "VoxCPM2 默认音色",
          language: "zh-CN",
          gender: "neutral",
          age: "adult",
          style: ["dialogue"],
        },
        outputFormat: "mp3",
      },
      startedAt: new Date("2026-06-03T00:00:00.000Z"),
      prismaClient,
      routeAttemptContext: {
        selectedCandidate: {
          candidateId: "variant:1",
          source: "speaker_engine_variant",
          provider: "voxcpm",
          voiceId: "__voxcpm_default__",
          voiceProfile: {
            provider: "voxcpm",
            voiceId: "__voxcpm_default__",
          },
          isDefault: true,
          routingWeight: 1,
          score: 1,
          eligible: true,
          healthy: true,
          rule: "speaker_engine_variant",
          reason: [],
          presetMatch: "none",
          matchedPreset: null,
          speakerEngineVariantId: "variant-1",
        },
        rankedCandidates: [],
        routeDecision: {
          policyVersion: "engine-router-v1",
          roleType: "dialogue",
          emotionLabel: null,
          priority: null,
          engineHint: null,
          preferredProvider: "voxcpm",
          selectedEngine: "voxcpm",
          selectedVoiceId: "__voxcpm_default__",
          selectedSource: "speaker_engine_variant",
          selectedRule: "speaker_engine_variant",
          selectedCandidateId: "variant:1",
          fallbackDepth: 0,
          isFallback: false,
          candidateCount: 1,
          engineHealth: {},
          candidateTrace: [],
          fallbackPath: [],
        },
        candidateIndex: 0,
        policyVersion: "engine-router-v1",
      },
    });

    expect(tx.audioFile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: "voxcpm",
          engineUsed: "voxcpm",
        }),
      })
    );
    expect(tx.speakerEngineVariant.updateMany).toHaveBeenCalledWith({
      where: {
        id: "variant-1",
        referenceAudio: null,
      },
      data: {
        referenceAudio: "voxcpm2_reference.wav",
      },
    });
  });
});
