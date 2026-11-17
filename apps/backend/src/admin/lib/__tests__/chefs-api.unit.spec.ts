import { chefsFetch } from "../chefs-api"

describe("chefsFetch", () => {
  afterEach(() => { delete (globalThis as any).fetch })
  it("resolves status 0 on network failure", async () => {
    ;(globalThis as any).fetch = async () => { throw new TypeError("failed") }
    expect(await chefsFetch("/x")).toEqual({ ok: false, status: 0, body: {} })
  })
  it("parses http errors", async () => {
    ;(globalThis as any).fetch = async () => ({ ok: false, status: 409, json: async () => ({ message: "invalid_transition" }) })
    expect(await chefsFetch("/x")).toEqual({ ok: false, status: 409, body: { message: "invalid_transition" } })
  })
  it("tolerates non-JSON bodies", async () => {
    ;(globalThis as any).fetch = async () => ({ ok: true, status: 200, json: async () => { throw new Error("x") } })
    expect(await chefsFetch("/x")).toEqual({ ok: true, status: 200, body: {} })
  })
})
