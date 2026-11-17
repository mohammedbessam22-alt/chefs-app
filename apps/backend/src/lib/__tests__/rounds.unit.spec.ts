import { nextRound } from "../rounds"

// times are Baghdad (UTC+3); rounds 12:00,16:00,20:00; cutoff 30
const R = ["12:00", "16:00", "20:00"]
const at = (iso: string) => new Date(iso)

describe("nextRound", () => {
  it("picks the next round after now", () => {
    expect(nextRound(at("2026-11-20T12:00:00+03:00"), R, 30)?.label).toBe("16:00")
  })
  it("still picks a round before its cut-off", () => {
    expect(nextRound(at("2026-11-20T15:29:00+03:00"), R, 30)?.label).toBe("16:00")
  })
  it("moves to the next round exactly at cut-off", () => {
    expect(nextRound(at("2026-11-20T15:30:00+03:00"), R, 30)?.label).toBe("20:00")
  })
  it("rolls over to the first round tomorrow", () => {
    expect(nextRound(at("2026-11-20T19:45:00+03:00"), R, 30)).toEqual({
      label: "12:00",
      departs_at: "2026-11-21T09:00:00.000Z",
    })
    expect(nextRound(at("2026-11-20T23:50:00+03:00"), R, 30)?.departs_at).toBe(
      "2026-11-21T09:00:00.000Z"
    )
  })
  it("handles unsorted rounds and UTC clock crossing the Baghdad date", () => {
    // 22:30 UTC on the 20th is 01:30 Baghdad on the 21st
    expect(nextRound(at("2026-11-20T22:30:00Z"), ["20:00", "12:00"], 30)).toEqual({
      label: "12:00",
      departs_at: "2026-11-21T09:00:00.000Z",
    })
  })
  it("finds a round just after midnight whose cut-off is the previous day", () => {
    expect(nextRound(at("2026-11-20T23:50:00+03:00"), ["00:15"], 30)).toEqual({
      label: "00:15",
      departs_at: "2026-11-21T21:15:00.000Z",
    })
    expect(nextRound(at("2026-11-21T00:00:00+03:00"), ["00:15"], 30)).toEqual({
      label: "00:15",
      departs_at: "2026-11-21T21:15:00.000Z",
    })
  })
  it("handles cut-offs of a day or more", () => {
    expect(nextRound(at("2026-11-20T13:00:00+03:00"), ["12:00"], 1440)?.departs_at).toBe(
      "2026-11-22T09:00:00.000Z"
    )
  })
  it("returns null with no rounds", () => {
    expect(nextRound(new Date(), [], 30)).toBeNull()
  })
})
