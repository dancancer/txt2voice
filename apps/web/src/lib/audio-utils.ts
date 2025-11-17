export function normalizeDurationSeconds(
  rawDuration?: number | string | null,
  convertThresholdMs: number = 1000
): number {
  if (rawDuration === null || rawDuration === undefined) {
    return 0
  }

  const numeric =
    typeof rawDuration === 'string' ? parseFloat(rawDuration) : Number(rawDuration)

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0
  }

  if (convertThresholdMs > 0 && numeric >= convertThresholdMs) {
    return Number((numeric / 1000).toFixed(2))
  }

  return Number(numeric.toFixed(2))
}
