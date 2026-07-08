export const CHARACTER_DISCOVERY_GENDER_VALUES = [
  "male",
  "female",
  "unknown",
] as const;

export type CharacterDiscoveryGender =
  (typeof CHARACTER_DISCOVERY_GENDER_VALUES)[number];

const CHARACTER_DISCOVERY_GENDER_ALIASES: Record<string, CharacterDiscoveryGender> =
  {
    male: "male",
    man: "male",
    男: "male",
    男性: "male",
    女: "female",
    female: "female",
    woman: "female",
    女性: "female",
    unknown: "unknown",
    未知: "unknown",
    不详: "unknown",
  };

export const normalizeCharacterDiscoveryGender = (
  value: unknown
): CharacterDiscoveryGender => {
  if (typeof value !== "string") {
    return "unknown";
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "unknown";
  }

  return CHARACTER_DISCOVERY_GENDER_ALIASES[normalized] ?? "unknown";
};
