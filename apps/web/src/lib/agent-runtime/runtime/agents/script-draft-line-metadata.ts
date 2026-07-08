import type { SegmentScriptDraftLine } from "../../context";

type DraftLineProsody = NonNullable<SegmentScriptDraftLine["prosody"]>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const asText = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const text = value.trim();
  return text.length > 0 ? text : undefined;
};

const asFiniteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

export const parseOptionalTone = (value: unknown): string | undefined =>
  asText(value);

export const parseOptionalStrength = (value: unknown): number | undefined =>
  asFiniteNumber(value);

export const parseOptionalPauseAfter = (value: unknown): number | undefined =>
  asFiniteNumber(value);

export const parseOptionalProsody = (
  value: unknown
): DraftLineProsody | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const prosody: DraftLineProsody = {};
  const pace = asFiniteNumber(value.pace);
  const pitch = asFiniteNumber(value.pitch);
  const energy = asFiniteNumber(value.energy);
  const pauseMsAfter = asFiniteNumber(value.pauseMsAfter);

  if (pace !== undefined) {
    prosody.pace = pace;
  }
  if (pitch !== undefined) {
    prosody.pitch = pitch;
  }
  if (energy !== undefined) {
    prosody.energy = energy;
  }
  if (pauseMsAfter !== undefined) {
    prosody.pauseMsAfter = pauseMsAfter;
  }

  return Object.keys(prosody).length > 0 ? prosody : undefined;
};
