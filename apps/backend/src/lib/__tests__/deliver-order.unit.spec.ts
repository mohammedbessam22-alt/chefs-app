import { groupItemsByLocation } from "../deliver-order"

describe("groupItemsByLocation", () => {
  it("groups the unfulfilled quantity per reservation location; no reservation -> default", () => {
    const g = groupItemsByLocation(
      [
        { id: "a", quantity: 2, fulfilled_quantity: 0 },
        { id: "b", quantity: 1, fulfilled_quantity: 0 },
        { id: "c", quantity: 3, fulfilled_quantity: 1 },
        { id: "d", quantity: 1, fulfilled_quantity: 1 },
        { id: "e", quantity: 0, fulfilled_quantity: 0 },
        { id: "f", quantity: 1, fulfilled_quantity: 0 },
      ],
      [
        { line_item_id: "a", location_id: "LA" },
        { line_item_id: "b", location_id: "LB" },
        { line_item_id: "c", location_id: "LA" },
        { line_item_id: null, location_id: "LB" },
      ]
    )
    expect(Object.fromEntries(g)).toEqual({
      LA: [
        { id: "a", quantity: 2 },
        { id: "c", quantity: 2 },
      ],
      LB: [{ id: "b", quantity: 1 }],
      __default__: [{ id: "f", quantity: 1 }],
    })
  })
})
