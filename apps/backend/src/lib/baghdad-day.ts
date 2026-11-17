// Business timezone Asia/Baghdad is fixed UTC+03:00 (same convention as lib/rounds.ts).
const BAGHDAD_OFFSET_MS = 180 * 60_000

export const baghdadDay = (ms: number) => new Date(ms + BAGHDAD_OFFSET_MS).toISOString().slice(0, 10)

/**
 * created_at filter covering one Baghdad calendar day. `date` defaults to today (Baghdad),
 * so in-memory filtering never scans all orders. Returns null when `date` is not a valid YYYY-MM-DD.
 */
export function baghdadDayFilter(date: string | undefined): { created_at: { $gte: string; $lt: string } } | null {
  const d = date ?? baghdadDay(Date.now())
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  const start = m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN
  if (!m || Number.isNaN(start) || new Date(start).toISOString().slice(0, 10) !== d) return null
  return {
    created_at: {
      $gte: new Date(start - BAGHDAD_OFFSET_MS).toISOString(),
      $lt: new Date(start + 86_400_000 - BAGHDAD_OFFSET_MS).toISOString(),
    },
  }
}
