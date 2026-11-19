import { deliveryDay, deliveryDayQuery } from "../baghdad-day"
import { nextRound } from "../rounds"

const R = ["12:00", "16:00", "20:00"]

describe("deliveryDay", () => {
  it("regular order placed at 21:00 (Baghdad) belongs to the next day's round", () => {
    const created = "2026-11-20T18:00:00.000Z" // 21:00 Baghdad
    const round = nextRound(new Date(created), R, 30)!
    expect(deliveryDay({ created_at: created, metadata: { delivery_type: "regular", round_departs_at: round.departs_at } })).toBe(
      "2026-11-21"
    )
  })
  it("regular order in a same-day round stays on that day", () => {
    expect(
      deliveryDay({ created_at: "2026-11-20T07:00:00.000Z", metadata: { delivery_type: "regular", round_departs_at: "2026-11-20T09:00:00.000Z" } })
    ).toBe("2026-11-20")
  })
  it("express order uses the Baghdad day it was placed, even late at night", () => {
    expect(deliveryDay({ created_at: "2026-11-20T18:00:00.000Z", metadata: { delivery_type: "express" } })).toBe("2026-11-20")
    // 22:30 UTC is already the next Baghdad day
    expect(deliveryDay({ created_at: "2026-11-20T22:30:00.000Z", metadata: { delivery_type: "express" } })).toBe("2026-11-21")
  })
  it("express ignores a stray round and prefers placed_at (handling time) over created_at", () => {
    expect(
      deliveryDay({
        created_at: "2026-11-10T08:00:00.000Z",
        metadata: { delivery_type: "express", round_departs_at: "2026-11-25T09:00:00.000Z", placed_at: "2026-11-20T08:00:00.000Z" },
      })
    ).toBe("2026-11-20")
  })
  it("order with no round (no round times / not stamped) falls back to the created day", () => {
    expect(deliveryDay({ created_at: "2026-11-20T18:00:00.000Z", metadata: { delivery_type: "regular" } })).toBe("2026-11-20")
    expect(deliveryDay({ created_at: "2026-11-20T18:00:00.000Z", metadata: null })).toBe("2026-11-20")
    expect(deliveryDay({ created_at: "2026-11-20T18:00:00.000Z", metadata: { round_departs_at: "garbage" } })).toBe("2026-11-20")
  })
})

describe("deliveryDayQuery", () => {
  it("bounds created_at to the day before through the day after (Baghdad)", () => {
    expect(deliveryDayQuery("2026-11-21")).toEqual({
      date: "2026-11-21",
      filters: { created_at: { $gte: "2026-11-19T21:00:00.000Z", $lt: "2026-11-22T21:00:00.000Z" } },
    })
  })
  it("rejects malformed dates", () => {
    expect(deliveryDayQuery("nope")).toBeNull()
    expect(deliveryDayQuery("2026-02-30")).toBeNull()
  })
  it("defaults to today in Baghdad", () => {
    const q = deliveryDayQuery(undefined)!
    expect(q.date).toBe(new Date(Date.now() + 180 * 60_000).toISOString().slice(0, 10))
  })
})
