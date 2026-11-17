// Business timezone Asia/Baghdad is fixed UTC+03:00 (same convention as lib/rounds.ts).
const BAGHDAD_OFFSET_MS = 180 * 60_000
const DAY_MS = 86_400_000

export const baghdadDay = (ms: number) => new Date(ms + BAGHDAD_OFFSET_MS).toISOString().slice(0, 10)

const validMs = (v: unknown): number | null => {
  if (typeof v !== "string" && !(v instanceof Date)) return null
  const ms = new Date(v as any).getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * The Baghdad day an order is delivered on: the day its round departs for regular orders,
 * else (express, or no round stamped) the day it was placed (metadata.placed_at, falling back to created_at).
 */
export function deliveryDay(o: { created_at: string | Date; metadata?: Record<string, any> | null }): string {
  const m = o.metadata ?? {}
  if (m.delivery_type !== "express") {
    const departs = validMs(m.round_departs_at)
    if (departs !== null) return baghdadDay(departs)
  }
  return baghdadDay(validMs(m.placed_at) ?? (validMs(o.created_at) as number))
}

/**
 * Validates `date` (YYYY-MM-DD, default today in Baghdad) and returns a created_at filter wide enough
 * to hold every order delivered that day: placed from the previous Baghdad day through the next one.
 * Callers then keep only orders whose `deliveryDay` equals `date`. Null when `date` is malformed.
 */
export function deliveryDayQuery(
  date: string | undefined
): { date: string; filters: { created_at: { $gte: string; $lt: string } } } | null {
  const d = date ?? baghdadDay(Date.now())
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  const start = m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN
  if (!m || Number.isNaN(start) || new Date(start).toISOString().slice(0, 10) !== d) return null
  return {
    date: d,
    filters: {
      created_at: {
        $gte: new Date(start - DAY_MS - BAGHDAD_OFFSET_MS).toISOString(),
        $lt: new Date(start + 2 * DAY_MS - BAGHDAD_OFFSET_MS).toISOString(),
      },
    },
  }
}
