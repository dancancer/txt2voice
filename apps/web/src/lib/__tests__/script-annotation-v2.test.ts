import { normalizeEmotionLabel } from "../script-generator/storage/persistence";

describe("annotation v2 emotion normalization", () => {
  it("maps known chinese and english tone aliases", () => {
    expect(normalizeEmotionLabel("平静")).toBe("calm");
    expect(normalizeEmotionLabel("冷笑")).toBe("cold");
    expect(normalizeEmotionLabel("happy")).toBe("joy");
    expect(normalizeEmotionLabel("angry shout")).toBe("angry");
    expect(normalizeEmotionLabel("春情萌动")).toBe("romantic_arousal");
  });

  it("falls back to calm when tone is empty or unknown", () => {
    expect(normalizeEmotionLabel("")).toBe("calm");
    expect(normalizeEmotionLabel("mystery")).toBe("calm");
    expect(normalizeEmotionLabel(undefined)).toBe("calm");
  });
});
