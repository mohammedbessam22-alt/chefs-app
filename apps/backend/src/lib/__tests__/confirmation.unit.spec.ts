import { applyAction } from "../confirmation"

describe("applyAction", () => {
  it("allows valid transitions", () => {
    expect(applyAction("awaiting", "confirm")).toBe("confirmed")
    expect(applyAction("confirmed", "deliver")).toBe("delivered")
    expect(applyAction("awaiting", "cancel")).toBe("cancelled")
    expect(applyAction("confirmed", "cancel")).toBe("cancelled")
  })
  it("rejects invalid transitions", () => {
    for (const [c, a] of [
      ["cancelled", "confirm"],
      ["delivered", "cancel"],
      ["awaiting", "deliver"],
      ["delivered", "deliver"],
    ] as const) {
      expect(() => applyAction(c, a)).toThrow("invalid_transition")
    }
  })
})
