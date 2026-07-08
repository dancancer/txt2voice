// 一旦我被更新，请更新我的开头注释
// input: 自动编排 preset id 与调用方覆盖项
// output: 稳定 resolvedOptions 快照断言
// pos: 自动编排预设模块测试
import {
  resolveAutoPipelineOptionsSnapshot,
  resolveAutoPipelinePreset,
  ZERO_TOUCH_VOXCPM_PRESET_ID,
  ZERO_TOUCH_VOXCPM_PRESET_VERSION,
} from "@/lib/auto-pipeline/presets";

describe("auto pipeline presets", () => {
  it("should resolve zero-touch VoxCPM defaults", () => {
    expect(resolveAutoPipelinePreset(ZERO_TOUCH_VOXCPM_PRESET_ID)).toEqual({
      presetId: ZERO_TOUCH_VOXCPM_PRESET_ID,
      presetVersion: ZERO_TOUCH_VOXCPM_PRESET_VERSION,
      resolvedOptions: {
        audioGeneration: {
          autoMerge: false,
          options: {
            preferredProvider: "voxcpm",
            skipExisting: true,
          },
        },
        qualityCheck: {
          enabled: true,
        },
      },
    });
  });

  it("should sanitize caller overrides inside the preset snapshot", () => {
    const snapshot = resolveAutoPipelineOptionsSnapshot(
      ZERO_TOUCH_VOXCPM_PRESET_ID,
      {
        audioGeneration: {
          options: {
            preferredProvider: "legacy-provider" as any,
            routerPolicyVersion: "router-v2",
          },
        },
        qualityCheck: {
          enabled: false,
        },
      }
    );

    expect(snapshot.resolvedOptions).toEqual({
      audioGeneration: {
        autoMerge: false,
        options: {
          preferredProvider: "voxcpm",
          routerPolicyVersion: "router-v2",
          skipExisting: true,
        },
      },
      qualityCheck: {
        enabled: false,
      },
    });
  });
});
