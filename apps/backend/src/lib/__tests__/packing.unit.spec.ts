import { groupByLocation } from "../packing"

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
