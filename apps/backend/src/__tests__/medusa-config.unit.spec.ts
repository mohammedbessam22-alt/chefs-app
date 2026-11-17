describe("medusa-config locking", () => {
  const load = (redisUrl?: string) => {
    const prev = process.env.REDIS_URL
    if (redisUrl) process.env.REDIS_URL = redisUrl
    else delete process.env.REDIS_URL
    let cfg: any
    jest.isolateModules(() => {
      cfg = require("../../medusa-config")
    })
    if (prev === undefined) delete process.env.REDIS_URL
    else process.env.REDIS_URL = prev
    return cfg
  }
  const lockingEntry = (cfg: any) => {
    const mods = cfg.modules
    const list = Array.isArray(mods) ? mods : Object.values(mods)
    return list.find((m: any) => m?.resolve === "@medusajs/medusa/locking")
  }

  it("registers the redis locking provider as default when REDIS_URL is set", () => {
    const entry = lockingEntry(load("redis://127.0.0.1:6379/3"))
    expect(entry).toBeDefined()
    const p = entry.options.providers[0]
    expect(p.resolve).toBe("@medusajs/medusa/locking-redis")
    expect(p.is_default).toBe(true)
    expect(p.options.redisUrl).toBe("redis://127.0.0.1:6379/3")
  })
})
