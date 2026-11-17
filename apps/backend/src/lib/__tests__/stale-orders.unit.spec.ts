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
  it("ages from metadata.placed_at (subscriber handling time) when present, e.g. a converted old draft", () => {
    const old = new Date(+now - 3 * 86400_000).toISOString()
    const fresh = { id: "x", created_at: old, metadata: { confirmation: "awaiting", placed_at: new Date(+now - 10 * 60000).toISOString() } }
    const stale = { id: "y", created_at: old, metadata: { confirmation: "awaiting", placed_at: new Date(+now - 121 * 60000).toISOString() } }
    const bad = { id: "z", created_at: old, metadata: { confirmation: "awaiting", placed_at: "garbage" } }
    expect(selectStale([fresh, stale, bad], now, 120)).toEqual(["y", "z"])
  })
})
