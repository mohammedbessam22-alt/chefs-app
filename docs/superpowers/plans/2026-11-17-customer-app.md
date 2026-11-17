# chefs-app Customer App (Expo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An iOS + Android app in Arabic, Kurdish (Sorani), Turkmen and English where customers browse ~500 products, fill a cart, choose Regular or Express, and tap "Send order on WhatsApp", which saves the order in Medusa and opens WhatsApp with the order pre-filled.

**Architecture:** Expo (React Native, TypeScript) with Expo Router. All data comes from the Medusa backend (backend plan) through `@medusajs/js-sdk`; server state via TanStack Query; the cart is a Medusa cart whose id is kept in AsyncStorage. Pure logic (localization, formatting, validation, message building) lives in `src/lib` with unit tests; screens stay thin.

**Tech Stack:** Expo SDK (latest), Expo Router, `@medusajs/js-sdk`, `@tanstack/react-query`, `i18next` + `react-i18next`, `@react-native-async-storage/async-storage`, `react-native-maps`, `expo-location`, `expo-updates`, Jest (`jest-expo`) + `@testing-library/react-native`, EAS Build/Submit.

**Spec:** `docs/superpowers/specs/2026-10-30-grocery-delivery-app-design.md` · **Depends on:** `docs/superpowers/plans/2026-11-17-backend.md` (endpoints and checkout contract in its Tasks 3, 4, 7, 8).

## Global Constraints

- Locales `ar` (default, base product text), `ckb`, `tk`, `en`. `ar`/`ckb` right-to-left; `tk`/`en` left-to-right. Missing translation → Arabic.
- No sign-in. Name, phone, map pin and landmark entered at first order and remembered on the device.
- Checkout = exactly one choice (Regular | Express) + "Send order on WhatsApp". Cash on delivery; no payment UI.
- Prices in whole IQD, formatted with thousands separators and the suffix `د.ع` (Arabic/Kurdish) or `IQD` (Turkmen/English).
- Shop WhatsApp number and next round come from `GET /store/chefs/delivery`; never hard-coded.
- Env: `EXPO_PUBLIC_MEDUSA_URL`, `EXPO_PUBLIC_PUBLISHABLE_KEY`. App name and bundle id are placeholders (`Chefs`, `com.chefsapp.app`) until the owner decides (spec §10).
- `apps/customer` is an independent npm project.

## Review Focus

1. A very large cart must still open WhatsApp: if the encoded `wa.me` URL exceeds 2000 characters, send a short message (order number, item count, total, map link) instead. → Task 6 test.
2. An order saved but never sent (customer backed out of WhatsApp) must show in "My orders" with a "Send again on WhatsApp" button that rebuilds the same message. → Task 7.
3. Price or stock changed since the cart was filled: the cart is re-fetched on focus, and a completion failure shows "Some items are no longer available" and refreshes the cart instead of a generic error. → Task 6 test.
4. Switching between an RTL and an LTR language must flip the layout (requires reload) without losing the cart. → Task 2 test + manual check.
5. A phone typed as `0770 123 4567` or with Arabic-Indic digits `٠٧٧٠١٢٣٤٥٦٧` must be accepted and normalized. → Task 5 test.

---

### Task 1: Scaffold the app and API client

**Files:**
- Create: `apps/customer/` (generated), `apps/customer/src/lib/medusa.ts`, `apps/customer/.env.example`, `apps/customer/jest.config.js`

**Interfaces:**
- Produces: `sdk` (configured `Medusa` instance with `baseUrl` and `publishableKey` from env); `queryClient`; root layout `app/_layout.tsx` wrapping `QueryClientProvider`; npm scripts `start`, `test`.

- [ ] **Step 1:** `npx create-expo-app@latest customer --template tabs` inside `apps/`; add dependencies listed in Tech Stack; configure `jest-expo` preset.
- [ ] **Step 2:** Create `src/lib/medusa.ts` and the env example; a smoke test `src/lib/__tests__/medusa.test.ts` asserting `sdk` is defined and reads `EXPO_PUBLIC_MEDUSA_URL`.
- [ ] **Step 3:** `npm test` → PASS; `npx expo start` opens on a phone with Expo Go against the dev backend.
- [ ] **Step 4: Commit** — `chore: scaffold Expo customer app`

### Task 2: Languages and right-to-left

**Files:**
- Create: `src/i18n/index.ts`, `src/i18n/locales/{ar,ckb,tk,en}.json`, `src/lib/locale.ts`, `app/language.tsx`
- Test: `src/lib/__tests__/locale.test.ts`

**Interfaces:**
- Produces: `type Locale = "ar" | "ckb" | "tk" | "en"`; `isRtl(l: Locale): boolean`; `getSavedLocale(): Promise<Locale | null>`; `setLocale(l: Locale): Promise<void>` (saves, changes i18next, and if `isRtl` differs from `I18nManager.isRTL` calls `I18nManager.forceRTL` then `Updates.reloadAsync()`); `useT()` re-export. First launch (no saved locale) routes to `app/language.tsx` with four buttons labelled in their own language: العربية · کوردی · Türkmençe · English.

- [ ] **Step 1: Failing tests**

```ts
expect(isRtl("ar")).toBe(true); expect(isRtl("ckb")).toBe(true)
expect(isRtl("tk")).toBe(false); expect(isRtl("en")).toBe(false)
it("does not reload when direction is unchanged", async () => { /* I18nManager.isRTL=true; setLocale("ckb") → reloadAsync not called */ })
it("reloads when switching ar → en and keeps the cart id", async () => { /* AsyncStorage cart_id set; setLocale("en") → reloadAsync called once; cart_id still stored */ })
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; all UI strings go through `t()` from now on, Arabic file complete, other three files may start as copies to be translated. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat: four languages with RTL switching`

### Task 3: Catalog data and localization

**Files:**
- Create: `src/lib/localize.ts`, `src/lib/money.ts`, `src/api/catalog.ts`
- Test: `src/lib/__tests__/localize.test.ts`, `src/lib/__tests__/money.test.ts`

**Interfaces:**
- Consumes: `GET /store/chefs/translations?locale=` (backend Task 8), standard `/store/product-categories`, `/store/collections`, `/store/products` (`category_id`, `collection_id`, `q`, `region_id`, `fields=+variants.inventory_quantity`).
- Produces:
  - `type Translations = { product: Record<string, {title: string; description?: string | null}>; category: …; collection: … }`
  - `localize<T extends {id: string; title?: string; name?: string; description?: string | null}>(entity: T, kind: "product" | "category" | "collection", tr: Translations | undefined): T` — overlays title/name/description when present, otherwise returns Arabic unchanged.
  - `formatIQD(amount: number, locale: Locale): string`.
  - Hooks: `useTranslations()`, `useCategories()`, `useCollections()`, `useProducts({ categoryId?, collectionId?, q? })` (paged, 20 per page), `useProduct(handle)` — all return localized entities; `inStock(product): boolean` (first variant `inventory_quantity > 0`).

- [ ] **Step 1: Failing tests**

```ts
const tr = { product: { p1: { title: "برنج" } }, category: {}, collection: {} }
expect(localize({ id: "p1", title: "رز", description: "وصف" }, "product", tr)).toEqual({ id: "p1", title: "برنج", description: "وصف" })
expect(localize({ id: "p2", title: "سكر" }, "product", tr).title).toBe("سكر")
expect(localize({ id: "c1", name: "خضار" }, "category", undefined).name).toBe("خضار")
expect(formatIQD(12500, "en")).toBe("12,500 IQD")
expect(formatIQD(12500, "ar")).toBe("12,500 د.ع")
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat: catalog queries with translation fallback`

### Task 4: Catalog screens

**Files:**
- Create: `app/(tabs)/index.tsx` (home), `app/(tabs)/search.tsx`, `app/category/[id].tsx`, `app/brand/[id].tsx`, `app/product/[handle].tsx`, `src/components/{ProductCard,ProductGrid,QuantityStepper}.tsx`
- Test: `src/components/__tests__/ProductCard.test.tsx`

**Interfaces:**
- Consumes: Task 3 hooks, `useCart()` from Task 5 (`addItem(variantId, qty)`).
- Produces: Home = category grid + brand row; category/brand pages = product grid with infinite scroll; search with 300 ms debounce; product page = image, title, price, description, stepper, "Add to cart". Out-of-stock products show a badge and a disabled add button.

- [ ] **Step 1: Failing test**: `ProductCard` with `inStock=false` renders `t("outOfStock")` and its add button is disabled; with stock it calls `onAdd` once when pressed.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement screens.** **Step 4: Run** → PASS; manual pass on a phone in Arabic and English.
- [ ] **Step 5: Commit** — `feat: catalog browsing screens`

> Task 4 uses `useCart().addItem`; implement Task 5's `useCart` first if executing out of order.

### Task 5: Cart, delivery choice and customer details

**Files:**
- Create: `src/api/cart.ts`, `src/lib/details.ts`, `app/(tabs)/cart.tsx`, `app/details.tsx`, `src/components/PinPicker.tsx`
- Test: `src/lib/__tests__/details.test.ts`

**Interfaces:**
- Consumes: `GET /store/chefs/delivery` (backend Task 3); shipping options named `Regular`/`Express`.
- Produces:
  - `useCart()` → `{ cart, addItem(variantId, qty), updateItem(lineId, qty), removeItem(lineId), shippingOptions: {id, name, amount, deliveryType: "regular" | "express"}[], refresh() }` (creates the Medusa cart in region Iraq on first add; cart id in AsyncStorage `cart_id`; refetch on screen focus).
  - `useDelivery()` → `{ whatsapp_number, next_round }`.
  - `type CustomerDetails = { name: string; phone: string /* 9647XXXXXXXXX */; lat: number; lng: number; landmark: string }`; `normalizePhone(input: string): string | null`; `validateDetails(d: Partial<CustomerDetails>): Record<keyof CustomerDetails, string> | null` (error keys are i18n keys); `loadDetails()/saveDetails(d)` (AsyncStorage `customer_details`).
  - Cart screen: lines with steppers, Regular/Express toggle (Regular shows `t("arrivesWithRound", { time: next_round.label })`), item subtotal, delivery fee, total, button "Send order on WhatsApp" (goes to `app/details.tsx` if no saved details, else straight to Task 6's `placeAndSend`).
  - `PinPicker`: map centred on Kirkuk (35.4681, 44.3922), "use my location" via `expo-location`, draggable pin; returns `{lat,lng}`.

- [ ] **Step 1: Failing tests**

```ts
expect(normalizePhone("0770 123 4567")).toBe("9647701234567")
expect(normalizePhone("٠٧٧٠١٢٣٤٥٦٧")).toBe("9647701234567")
expect(normalizePhone("+9647701234567")).toBe("9647701234567")
expect(normalizePhone("123")).toBeNull()
expect(validateDetails({ name: "", phone: "0770", landmark: "" })).toMatchObject({ name: "required", phone: "invalidPhone", lat: "pinRequired", landmark: "required" })
expect(validateDetails({ name: "Ali", phone: "07701234567", lat: 35.4, lng: 44.3, landmark: "near mosque" })).toBeNull()
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; manual: add items, switch Regular/Express and see fee and total change.
- [ ] **Step 5: Commit** — `feat: cart, delivery choice and customer details`

### Task 6: Place the order and open WhatsApp

**Files:**
- Create: `src/lib/whatsapp.ts`, `src/api/checkout.ts`
- Test: `src/lib/__tests__/whatsapp.test.ts`, `src/api/__tests__/checkout.test.ts`

**Interfaces:**
- Consumes: backend checkout contract (backend Task 4 header comment): email `<phone>@guest.chefs-app.local`, `shipping_address { first_name, phone, address_1: landmark, city: "Kirkuk", country_code: "iq", metadata: { lat, lng } }`, payment provider `pp_system_default`.
- Produces:
  - `type SentOrder = { id: string; display_id: number; created_at: string; total: number; delivery_type: "regular" | "express"; round_label?: string; items: {title: string; quantity: number; total: number}[]; delivery_fee: number }`
  - `buildOrderMessage(o: SentOrder, d: CustomerDetails, t: TFunction, locale: Locale): string` — lines: `#<display_id>`, one line per item `title × qty — price`, delivery line (Regular + round or Express) with fee, total, name, phone, landmark, `https://maps.google.com/?q=<lat>,<lng>`.
  - `buildShortMessage(o, d, t, locale): string` — `#<display_id>`, item count, total, name, map link.
  - `whatsappUrl(number: string, text: string, fallback?: () => string): string` → `https://wa.me/<number>?text=<encoded>`; when the URL would exceed 2000 chars and `fallback` is given, encodes `fallback()` instead (callers pass `buildShortMessage`).
  - `placeAndSend(cartId: string, d: CustomerDetails, deliveryOptionId: string): Promise<SentOrder>` — follows the contract, saves the order to AsyncStorage `orders` (array, newest first, includes the `SentOrder`), clears `cart_id`, opens WhatsApp via `Linking.openURL`. On completion failure caused by stock it throws `Error("items_unavailable")`.

- [ ] **Step 1: Failing tests**

```ts
const o: SentOrder = { id: "order_1", display_id: 1042, created_at: "…", total: 14500, delivery_type: "regular", round_label: "16:00", items: [{ title: "رز", quantity: 2, total: 12500 }], delivery_fee: 2000 }
const d = { name: "علي", phone: "9647701234567", lat: 35.47, lng: 44.39, landmark: "قرب الجامع" }
const msg = buildOrderMessage(o, d, t, "ar")
expect(msg).toContain("#1042"); expect(msg).toContain("رز × 2"); expect(msg).toContain("16:00")
expect(msg).toContain("https://maps.google.com/?q=35.47,44.39")
expect(whatsappUrl("9647701234567", "hi")).toBe("https://wa.me/9647701234567?text=hi")
const big = { ...o, items: Array.from({ length: 120 }, (_, i) => ({ title: `منتج طويل الاسم ${i}`, quantity: 1, total: 1000 })) }
const url = whatsappUrl("9647701234567", buildOrderMessage(big, d, t, "ar"), () => buildShortMessage(big, d, t, "ar"))
expect(url.length).toBeLessThanOrEqual(2000); expect(decodeURIComponent(url)).toContain("#1042")
```

- [ ] **Step 2: Failing checkout test** (mock `sdk`): when `sdk.store.cart.complete` rejects with an inventory error, `placeAndSend` throws `items_unavailable`, does not open WhatsApp and keeps `cart_id`; on success it stores the order, clears `cart_id`, and calls `Linking.openURL` once with a `wa.me` URL.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement**; cart screen shows `t("itemsUnavailable")` and calls `refresh()` on that error. **Step 5: Run** → PASS.
- [ ] **Step 6: Manual check** against the dev backend: order appears in admin "Orders (WhatsApp)" as awaiting; WhatsApp opens with the message.
- [ ] **Step 7: Commit** — `feat: save order and send it on WhatsApp`

### Task 7: My orders

**Files:**
- Create: `app/(tabs)/orders.tsx`, `src/api/orders.ts`
- Test: `src/api/__tests__/orders.test.ts`

**Interfaces:**
- Consumes: `GET /store/chefs/orders/:id` (backend Task 7); stored `orders`.
- Produces: list of stored orders with live status (`awaiting` / `confirmed` / `delivered` / `cancelled` → localized labels); `awaiting` rows get "Send again on WhatsApp" which calls `Linking.openURL(whatsappUrl(...))` with the stored `SentOrder` and current details; 404 rows show as cancelled.

- [ ] **Step 1: Failing test**: `useOrders()` with two stored orders and a mocked status endpoint returning `confirmed` and 404 yields statuses `["confirmed", "cancelled"]` in stored order.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat: my orders with resend on WhatsApp`

### Task 8: Store builds

**Files:**
- Create: `apps/customer/eas.json`, `apps/customer/assets/{icon.png,splash.png}` (placeholders)
- Modify: `apps/customer/app.json`

**Interfaces:**
- Produces: `app.json` with `name: "Chefs"`, `ios.bundleIdentifier` and `android.package` `com.chefsapp.app`, `supportsRTL: true`, location permission strings in Arabic and English, Google Maps Android API key from env; `eas.json` profiles `preview` (internal distribution, staging API) and `production` (prod API).

- [ ] **Step 1:** Configure; `npx eas build -p android --profile preview` → installable APK; install on two phones and run the full flow.
- [ ] **Step 2:** `npx eas build -p all --profile production`; `npx eas submit -p android` to the Google Play **closed testing** track with ≥12 testers (14-day clock starts); `npx eas submit -p ios` to TestFlight.
- [ ] **Step 3:** After 14 days and owner sign-off, promote Android to production and submit iOS for review.
- [ ] **Step 4: Commit** — `chore: EAS build and store configuration`
