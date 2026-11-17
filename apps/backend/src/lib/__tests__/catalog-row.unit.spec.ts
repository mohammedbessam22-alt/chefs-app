import { parseCatalogRow } from "../catalog-row"

const base = {
  handle: "rice-1kg",
  category_ar: "حبوب",
  brand: "Alsultan",
  warehouse: "A",
  price_iqd: "2500",
  stock: "40",
  image: "",
  title_ar: "رز 1 كغم",
  description_ar: "",
  title_ckb: "",
  title_tk: "",
  title_en: "Rice 1kg",
}

describe("parseCatalogRow", () => {
  it("parses a valid row", () => {
    const r = parseCatalogRow(base, 2)
    expect(r.price_iqd).toBe(2500)
    expect(r.stock).toBe(40)
    expect(r.warehouse).toBe("A")
    expect(r.title_en).toBe("Rice 1kg")
  })

  it("accepts thousands separators and lowercase warehouse", () => {
    const r = parseCatalogRow({ ...base, price_iqd: "2,500", warehouse: "b" }, 3)
    expect(r.price_iqd).toBe(2500)
    expect(r.warehouse).toBe("B")
  })

  it("rejects a non-numeric price", () => {
    expect(() => parseCatalogRow({ ...base, price_iqd: "abc" }, 4)).toThrow("row 4: price_iqd")
    expect(() => parseCatalogRow({ ...base, price_iqd: "25.5" }, 4)).toThrow("row 4: price_iqd")
  })

  it("rejects missing required fields", () => {
    expect(() => parseCatalogRow({ ...base, title_ar: " " }, 5)).toThrow("row 5: title_ar")
    expect(() => parseCatalogRow({ ...base, handle: "" }, 5)).toThrow("row 5: handle")
    expect(() => parseCatalogRow({ ...base, handle: "a.b c" }, 5)).toThrow("row 5: handle")
    expect(() => parseCatalogRow({ ...base, warehouse: "C" }, 5)).toThrow("row 5: warehouse")
    expect(() => parseCatalogRow({ ...base, stock: "x" }, 5)).toThrow("row 5: stock")
    expect(() => parseCatalogRow({ ...base, stock: "-1" }, 5)).toThrow("row 5: stock")
  })

  it("treats blank stock as invalid", () => {
    expect(() => parseCatalogRow({ ...base, stock: "" }, 6)).toThrow("row 6: stock")
  })
})
