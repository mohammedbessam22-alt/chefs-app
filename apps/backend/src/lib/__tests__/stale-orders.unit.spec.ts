import { selectStale } from "../stale-orders"

const now = new Date("2026-11-20T12:00:00Z")
const o = (id: string, minsAgo: number, confirmation?: string) => ({
  id,
  created_at: new Date(+now - minsAgo * 60000).toISOString(),
  metadata: confirmation ? { confirmation } : {},
})

describe("selectStale", () => {
  it("selects only awaiting orders older than the limit", () => {
    expect(
      selectStale(
        [o("a", 121, "awaiting"), o("b", 119, "awaiting"), o("c", 500, "confirmed"), o("d", 500, "delivered"), o("e", 500, "cancelled")],
        now,
        120
      )
    ).toEqual(["a"])
  })
  it("treats missing confirmation as awaiting", () => {
    expect(selectStale([o("a", 200)], now, 120)).toEqual(["a"])
  })
  it("excludes exactly-at-limit orders", () => {
    expect(selectStale([o("a", 120, "awaiting")], now, 120)).toEqual([])
  })
})
