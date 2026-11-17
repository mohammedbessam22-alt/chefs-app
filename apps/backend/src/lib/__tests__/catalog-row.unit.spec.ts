import { catalogProductFields, parseCatalogRow } from "../catalog-row"

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

  it("rejects a zero price", () => {
    expect(() => parseCatalogRow({ ...base, price_iqd: "0" }, 5)).toThrow("row 5: price_iqd")
    expect(() => parseCatalogRow({ ...base, price_iqd: "000" }, 5)).toThrow("row 5: price_iqd")
    expect(parseCatalogRow({ ...base, stock: "0" }, 5).stock).toBe(0) // zero stock is fine
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

describe("catalogProductFields", () => {
  const row = parseCatalogRow(base, 2)
  const blank = parseCatalogRow({ ...base, description_ar: "", category_ar: "", brand: "" }, 2)
  const refs = { category_id: "cat_1", collection_id: "col_1" }

  it("update with blank description/category/brand keeps what is there (fields omitted)", () => {
    const f = catalogProductFields(blank, {}, "update")
    expect(f).toEqual({ title: base.title_ar })
    expect("description" in f).toBe(false)
    expect("category_ids" in f).toBe(false)
    expect("collection_id" in f).toBe(false)
  })
  it("update with values sets them", () => {
    expect(catalogProductFields({ ...row, description_ar: "وصف" }, refs, "update")).toEqual({
      title: base.title_ar,
      description: "وصف",
      category_ids: ["cat_1"],
      collection_id: "col_1",
    })
  })
  it("create with blanks sets none", () => {
    expect(catalogProductFields(blank, {}, "create")).toEqual({ title: base.title_ar, category_ids: [] })
  })
  it("create with values sets them", () => {
    expect(catalogProductFields({ ...row, description_ar: "وصف" }, refs, "create")).toEqual({
      title: base.title_ar,
      description: "وصف",
      category_ids: ["cat_1"],
      collection_id: "col_1",
    })
  })
})
