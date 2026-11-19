import { normalizeIraqiPhone } from "../phone"

describe("normalizeIraqiPhone", () => {
  it("normalizes common formats", () => {
    expect(normalizeIraqiPhone("0770 123 4567")).toBe("9647701234567")
    expect(normalizeIraqiPhone("+964 770 123 4567")).toBe("9647701234567")
    expect(normalizeIraqiPhone("9647701234567")).toBe("9647701234567")
  })
  it("rejects invalid numbers", () => {
    expect(() => normalizeIraqiPhone("12345")).toThrow("invalid_phone")
    expect(() => normalizeIraqiPhone("")).toThrow("invalid_phone")
  })
})
