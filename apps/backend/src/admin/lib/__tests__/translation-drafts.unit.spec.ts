import {
  blankTitleWithDescription,
  changedLocales,
  initialState,
  translationsReducer as reduce,
  type Action,
  type Drafts,
  type State,
} from "../translation-drafts"

const d = (o: Partial<Drafts> = {}): Drafts => ({
  ckb: { title: "", description: "" },
  tk: { title: "", description: "" },
  en: { title: "", description: "" },
  ...o,
})

describe("changedLocales", () => {
  it("is empty when nothing differs", () => {
    expect(changedLocales(d(), d())).toEqual([])
  })
  it("returns only locales whose title or description differ", () => {
    const snap = d({ en: { title: "A", description: "" } })
    const now = d({ en: { title: "A", description: "x" }, tk: { title: "T", description: "" } })
    expect(changedLocales(snap, now)).toEqual(["tk", "en"])
  })
  it("ignores surrounding whitespace-only differences", () => {
    expect(changedLocales(d({ en: { title: "A", description: "" } }), d({ en: { title: " A ", description: "" } }))).toEqual([])
  })
})

describe("blankTitleWithDescription", () => {
  it("lists locales with a description but blank title", () => {
    expect(
      blankTitleWithDescription(d({ ckb: { title: " ", description: "x" }, en: { title: "E", description: "y" } }))
    ).toEqual(["ckb"])
  })
  it("is empty when both blank", () => {
    expect(blankTitleWithDescription(d())).toEqual([])
  })
})

const run = (s: State, ...actions: Action[]) => actions.reduce(reduce, s)
const P = "prod_1"
const SERVER = d({ ckb: { title: "K", description: "kd" }, tk: { title: "T", description: "" } })

/** Initial load done for P with SERVER. */
const loaded = () =>
  run(initialState(P), { type: "LOAD_START", productId: P, reqId: 1 }, { type: "LOAD_OK", productId: P, reqId: 1, server: SERVER })

describe("translationsReducer", () => {
  it("starts in loading state with nothing editable", () => {
    const s = initialState(P)
    expect(s.status).toBe("loading")
    expect(reduce(s, { type: "EDIT", locale: "en", field: "title", value: "x" })).toBe(s)
    expect(reduce(s, { type: "SAVE_START", productId: P })).toBe(s)
  })

  it("initial load fills drafts from the server (empty drafts are not kept)", () => {
    const s = loaded()
    expect(s.status).toBe("ready")
    expect(s.snapshot).toEqual(SERVER)
    expect(s.drafts).toEqual(SERVER)
    expect(changedLocales(s.snapshot, s.drafts)).toEqual([])
  })

  it("an edit shows up in changedLocales", () => {
    const s = run(loaded(), { type: "EDIT", locale: "en", field: "title", value: "E" })
    expect(changedLocales(s.snapshot, s.drafts)).toEqual(["en"])
  })

  it("load failure keeps state, blocks edits/save, and Retry fills from server", () => {
    let s = run(initialState(P), { type: "LOAD_START", productId: P, reqId: 1 }, { type: "LOAD_FAIL", productId: P, reqId: 1 })
    expect(s.status).toBe("error")
    expect(reduce(s, { type: "EDIT", locale: "en", field: "title", value: "x" })).toBe(s)
    expect(reduce(s, { type: "SAVE_START", productId: P })).toBe(s)
    s = run(s, { type: "LOAD_START", productId: P, reqId: 2 }, { type: "LOAD_OK", productId: P, reqId: 2, server: SERVER })
    expect(s.drafts).toEqual(SERVER)
  })

  it("partial save failure: saved locales take server value, failed keep the draft", () => {
    let s = run(
      loaded(),
      { type: "EDIT", locale: "en", field: "title", value: "E" },
      { type: "EDIT", locale: "tk", field: "title", value: "T2" },
      { type: "SAVE_START", productId: P },
      { type: "SAVE_DONE", productId: P, saved: ["tk"], failed: ["en"], reqId: 2 }
    )
    expect(s.status).toBe("loading")
    expect(s.saveError).toEqual({ saved: ["tk"], failed: ["en"] })
    const server2 = d({ ...SERVER, tk: { title: "T2", description: "" } })
    s = run(s, { type: "LOAD_OK", productId: P, reqId: 2, server: server2 })
    expect(s.drafts.tk).toEqual(server2.tk)
    expect(s.drafts.en).toEqual({ title: "E", description: "" })
    expect(changedLocales(s.snapshot, s.drafts)).toEqual(["en"])
  })

  it("untouched locales take the new server value after refetch (no stale drafts)", () => {
    const server2 = d({ ...SERVER, ckb: { title: "K-other-admin", description: "" } })
    const s = run(
      loaded(),
      { type: "EDIT", locale: "en", field: "title", value: "E" },
      { type: "SAVE_START", productId: P },
      { type: "SAVE_DONE", productId: P, saved: ["en"], failed: [], reqId: 2 },
      { type: "LOAD_OK", productId: P, reqId: 2, server: { ...server2, en: { title: "E", description: "" } } }
    )
    expect(s.drafts.ckb).toEqual(server2.ckb)
    expect(changedLocales(s.snapshot, s.drafts)).toEqual([])
  })

  it("post-save refetch failure keeps drafts; Retry keeps failed edits and takes server for saved", () => {
    let s = run(
      loaded(),
      { type: "EDIT", locale: "en", field: "title", value: "E" },
      { type: "EDIT", locale: "tk", field: "title", value: "T2" },
      { type: "SAVE_START", productId: P },
      { type: "SAVE_DONE", productId: P, saved: ["tk"], failed: ["en"], reqId: 2 },
      { type: "LOAD_FAIL", productId: P, reqId: 2 }
    )
    expect(s.status).toBe("error")
    expect(s.drafts.en.title).toBe("E")
    expect(s.drafts.tk.title).toBe("T2")
    expect(s.snapshot).toEqual(SERVER)
    const server2 = d({ ...SERVER, tk: { title: "T2", description: "" } })
    s = run(s, { type: "LOAD_START", productId: P, reqId: 3 }, { type: "LOAD_OK", productId: P, reqId: 3, server: server2 })
    expect(s.status).toBe("ready")
    expect(s.drafts.en.title).toBe("E")
    expect(s.drafts.tk).toEqual(server2.tk)
    expect(changedLocales(s.snapshot, s.drafts)).toEqual(["en"])
  })

  it("ignores LOAD_OK / LOAD_FAIL / SAVE_DONE for an old product after RESET", () => {
    const s = run(loaded(), { type: "RESET", productId: "prod_2" }, { type: "LOAD_START", productId: "prod_2", reqId: 5 })
    expect(s.drafts).toEqual(d())
    expect(reduce(s, { type: "LOAD_OK", productId: P, reqId: 5, server: SERVER })).toBe(s)
    expect(reduce(s, { type: "LOAD_FAIL", productId: P, reqId: 5 })).toBe(s)
    expect(reduce(s, { type: "SAVE_DONE", productId: P, saved: ["en"], failed: [], reqId: 6 })).toBe(s)
    const ok = reduce(s, { type: "LOAD_OK", productId: "prod_2", reqId: 5, server: SERVER })
    expect(ok.drafts).toEqual(SERVER)
  })

  it("ignores a superseded request for the same product", () => {
    const s = run(initialState(P), { type: "LOAD_START", productId: P, reqId: 1 }, { type: "LOAD_START", productId: P, reqId: 2 })
    expect(reduce(s, { type: "LOAD_OK", productId: P, reqId: 1, server: SERVER })).toBe(s)
    expect(reduce(s, { type: "LOAD_FAIL", productId: P, reqId: 1 })).toBe(s)
  })

  it("applying the same action twice (StrictMode) is harmless", () => {
    const actions: Action[] = [
      { type: "RESET", productId: P },
      { type: "LOAD_START", productId: P, reqId: 1 },
      { type: "LOAD_OK", productId: P, reqId: 1, server: SERVER },
      { type: "EDIT", locale: "en", field: "title", value: "E" },
      { type: "SAVE_START", productId: P },
      { type: "SAVE_DONE", productId: P, saved: [], failed: ["en"], reqId: 2 },
      { type: "LOAD_OK", productId: P, reqId: 2, server: SERVER },
    ]
    const once = actions.reduce(reduce, initialState(P))
    const twice = actions.reduce((s, a) => reduce(reduce(s, a), a), initialState(P))
    expect(twice).toEqual(once)
    expect(once.drafts.en.title).toBe("E")
    // reducer is pure: same input state + action gives equal output
    const base = loaded()
    expect(reduce(base, actions[3])).toEqual(reduce(base, actions[3]))
  })
})
