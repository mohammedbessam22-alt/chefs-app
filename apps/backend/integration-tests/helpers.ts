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
