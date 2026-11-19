import { devScriptRefusal } from "../dev-script-guard"

const ok = { CHEFS_DEV_SCRIPT: "1" }
describe("devScriptRefusal", () => {
  it("allows opt-in, dev db, non-reserved port", () => {
    expect(devScriptRefusal(ok, "medusa_dev", "http://127.0.0.1:9200")).toBeNull()
  })
  it("requires opt-in", () => expect(devScriptRefusal({}, "medusa_dev", "http://127.0.0.1:9200")).toMatch(/opt in/))
  it("refuses production env", () => expect(devScriptRefusal({ ...ok, NODE_ENV: "production" }, "medusa_dev", "http://127.0.0.1:9200")).toMatch(/production/))
  it("refuses non-dev databases", () => {
    expect(devScriptRefusal(ok, "medusa_db", "http://127.0.0.1:9200")).toMatch(/not a dev/)
    expect(devScriptRefusal(ok, "medusa_staging", "http://127.0.0.1:9200")).toMatch(/not a dev/)
  })
  it("refuses ports 9000/9100 and bad urls", () => {
    expect(devScriptRefusal(ok, "medusa_dev", "http://127.0.0.1:9000")).toMatch(/9000/)
    expect(devScriptRefusal(ok, "medusa_dev", "http://127.0.0.1:9100")).toMatch(/9100/)
    expect(devScriptRefusal(ok, "medusa_dev", "nope")).toMatch(/valid URL/)
  })
})
