import { allowedActions, baghdadToday, buildOrdersQuery, buildPackingQuery, hasMore, whatsappUrl, mapsUrl, actionErrorMessage, clampOffset, tryBegin } from "../chefs-orders"

describe("baghdadToday", () => {
  it("uses UTC+3 (late UTC evening is already tomorrow)", () => {
    expect(baghdadToday(new Date("2026-11-17T21:30:00Z"))).toBe("2026-11-18")
    expect(baghdadToday(new Date("2026-11-17T20:59:00Z"))).toBe("2026-11-17")
  })
})

describe("buildOrdersQuery", () => {
  it("always sends date, limit, offset and skips empty filters", () => {
    expect(buildOrdersQuery({ confirmation: "", delivery_type: "", round_label: "", date: "2026-11-17" }, 0, 100)).toBe(
      "date=2026-11-17&limit=100&offset=0"
    )
  })
  it("encodes filters", () => {
    const q = buildOrdersQuery({ confirmation: "awaiting", delivery_type: "express", round_label: "10:00 am", date: "2026-11-17" }, 100, 100)
    expect(q).toContain("confirmation=awaiting")
    expect(q).toContain("delivery_type=express")
    expect(q).toContain("round_label=10%3A00+am")
    expect(q).toContain("offset=100")
  })
})

describe("buildPackingQuery", () => {
  it("sends date and optional round", () => {
    expect(buildPackingQuery({ round_label: "", date: "2026-11-17" })).toBe("date=2026-11-17")
    expect(buildPackingQuery({ round_label: "10:00", date: "2026-11-17" })).toBe("date=2026-11-17&round_label=10%3A00")
  })
})

describe("allowedActions", () => {
  it("maps states to buttons", () => {
    expect(allowedActions("awaiting")).toEqual(["confirm", "cancel"])
    expect(allowedActions("confirmed")).toEqual(["deliver", "cancel"])
    expect(allowedActions("delivered")).toEqual([])
    expect(allowedActions("cancelled")).toEqual([])
    expect(allowedActions("weird")).toEqual([])
  })
})

describe("hasMore", () => {
  it("is true while count exceeds what was loaded through this page", () => {
    expect(hasMore({ count: 150, offset: 0, length: 100 })).toBe(true)
    expect(hasMore({ count: 150, offset: 100, length: 50 })).toBe(false)
    expect(hasMore({ count: 0, offset: 0, length: 0 })).toBe(false)
  })
})

describe("links", () => {
  it("builds wa.me with digits only", () => {
    expect(whatsappUrl("+964 770 000 0000")).toBe("https://wa.me/9647700000000")
    expect(whatsappUrl("07700000000")).toBe("https://wa.me/9647700000000")
    expect(whatsappUrl("12345")).toBeNull()
    expect(whatsappUrl("0770")).toBeNull()
    expect(whatsappUrl(null)).toBeNull()
    expect(whatsappUrl("abc")).toBeNull()
  })
  it("builds maps link only when both coordinates exist", () => {
    expect(mapsUrl(35.1, 44.2)).toBe("https://maps.google.com/?q=35.1,44.2")
    expect(mapsUrl(null, 44.2)).toBeNull()
    expect(mapsUrl(0, 0)).toBeNull()
    expect(mapsUrl(NaN, 1)).toBeNull()
    expect(mapsUrl(Infinity, 1)).toBeNull()
    expect(mapsUrl(95, 1)).toBeNull()
  })
})

describe("actionErrorMessage", () => {
  it("explains 409 invalid_transition", () => {
    expect(actionErrorMessage(409, { message: "invalid_transition" })).toMatch(/changed.*refresh/i)
  })
  it("shows the server reason for a 409 not_allowed", () => {
    expect(actionErrorMessage(409, { type: "not_allowed", message: "All fulfillments must be canceled before canceling an order" })).toMatch(
      /fulfillments must be canceled/
    )
  })
  it("explains 404 and falls back", () => {
    expect(actionErrorMessage(404, { message: "order not found" })).toMatch(/not found/i)
    expect(actionErrorMessage(500, {})).toMatch(/failed/i)
  })
})

describe("clampOffset", () => {
  it("moves to the last page when past the end", () => {
    expect(clampOffset(200, 150, 100)).toBe(100)
    expect(clampOffset(100, 100, 100)).toBe(0)
    expect(clampOffset(100, 150, 100)).toBe(100)
    expect(clampOffset(100, 0, 100)).toBe(100)
  })
})

describe("tryBegin", () => {
  it("rejects a second begin until released", () => {
    const s = new Set<string>()
    expect(tryBegin(s, "a")).toBe(true)
    expect(tryBegin(s, "a")).toBe(false)
    expect(tryBegin(s, "b")).toBe(true)
    s.delete("a")
    expect(tryBegin(s, "a")).toBe(true)
  })
})

describe("network failure message", () => {
  it("status 0", () => expect(actionErrorMessage(0, {})).toMatch(/network/i))
})
