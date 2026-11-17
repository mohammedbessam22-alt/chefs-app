import { groupByLocation, resolveItemLocation } from "../packing"

describe("groupByLocation", () => {
  it("splits orders per warehouse and collects unmapped items", () => {
    const r = groupByLocation(
      [
        {
          display_id: 1,
          items: [
            { variant_id: "v1", title: "Rice", quantity: 2 },
            { variant_id: "v2", title: "Oil", quantity: 1 },
          ],
        },
        { display_id: 2, items: [{ variant_id: "v1", title: "Rice", quantity: 1 }] },
        { display_id: 3, items: [{ variant_id: "vX", title: "Stray", quantity: 4 }] },
      ],
      { v1: "A", v2: "B" }
    )
    expect(r.A).toEqual([
      { display_id: 1, items: [{ title: "Rice", quantity: 2 }] },
      { display_id: 2, items: [{ title: "Rice", quantity: 1 }] },
    ])
    expect(r.B).toEqual([{ display_id: 1, items: [{ title: "Oil", quantity: 1 }] }])
    expect(r.unassigned).toEqual([{ display_id: 3, items: [{ title: "Stray", quantity: 4 }] }])
  })
})

describe("resolveItemLocation", () => {
  it("prefers the reservation location", () => expect(resolveItemLocation(["B", "B"], ["A", "B"])).toBe("B"))
  it("reservations spanning locations are unassigned", () => expect(resolveItemLocation(["A", "B"], ["A"])).toBeUndefined())
  it("falls back to the single level location", () => expect(resolveItemLocation([], ["A", "A"])).toBe("A"))
  it("several or no level locations are unassigned", () => {
    expect(resolveItemLocation([], ["A", "B"])).toBeUndefined()
    expect(resolveItemLocation([], [])).toBeUndefined()
  })
})

describe("groupByLocation line items", () => {
  it("keys by line item id and skips zero quantity", () => {
    const r = groupByLocation(
      [{ display_id: 1, items: [{ id: "li1", variant_id: "v", title: "X", quantity: 1 }, { id: "li2", variant_id: "v", title: "Z", quantity: 0 }] }],
      { li1: "B", v: "A" }
    )
    expect(r).toEqual({ B: [{ display_id: 1, items: [{ title: "X", quantity: 1 }] }] })
  })
})
