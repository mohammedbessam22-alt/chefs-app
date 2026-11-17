// Business timezone Asia/Baghdad is fixed UTC+03:00 (no DST); server clock is UTC.
const BAGHDAD_OFFSET_MS = 180 * 60_000

export function nextRound(
  now: Date,
  roundTimes: string[],
  cutoffMinutes: number
): { label: string; departs_at: string } | null {
  if (!roundTimes.length) return null

  // Baghdad wall-clock "today" midnight, expressed as a UTC-field date
  const wall = new Date(now.getTime() + BAGHDAD_OFFSET_MS)
  const dayStart = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate())

  let best: { label: string; ms: number } | null = null
  for (const label of roundTimes) {
    const [h, m] = label.split(":").map(Number)
    const maxDay = Math.ceil(cutoffMinutes / 1440) + 1
    for (let day = 0; day <= maxDay; day++) {
      const ms = dayStart + day * 86_400_000 + (h * 60 + m) * 60_000 - BAGHDAD_OFFSET_MS
      // orderable until cut-off (strictly before it)
      if (ms - cutoffMinutes * 60_000 > now.getTime()) {
        if (!best || ms < best.ms) best = { label, ms }
        break
      }
    }
  }
  return best ? { label: best.label, departs_at: new Date(best.ms).toISOString() } : null
}
