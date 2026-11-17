export const storeHeaders = (key: string) => ({
  headers: { "x-publishable-api-key": key },
})

export const adminHeaders = (token: string) => ({
  headers: { authorization: `Bearer ${token}` },
})

export async function createCart(api: any, key: string, regionId: string) {
  const { data } = await api.post(
    "/store/carts",
    {
      region_id: regionId,
      shipping_address: {
        first_name: "Test",
        last_name: "Customer",
        address_1: "Street 1",
        city: "Kirkuk",
        country_code: "iq",
        phone: "07700000000",
      },
    },
    storeHeaders(key)
  )
  return data.cart
}

export async function getAdminToken(container: any, api: any): Promise<string> {
  const email = "admin@test.local"
  const password = "supersecret"
  const userModule = container.resolve("user")
  const authModule = container.resolve("auth")
  const user = await userModule.createUsers({ email })
  const { authIdentity } = await authModule.register("emailpass", {
    body: { email, password },
  } as any)
  await authModule.updateAuthIdentities({
    id: authIdentity!.id,
    app_metadata: { user_id: user.id },
  })
  const { data } = await api.post("/auth/user/emailpass", { email, password })
  return data.token
}
