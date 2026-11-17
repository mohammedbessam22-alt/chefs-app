# Grocery Delivery App (chefs-app) — Design

Date: 2026-10-30 · Revised: 2026-11-17 (orders via WhatsApp; driver app removed) · Status: draft, awaiting owner approval

## 1. Intent

A grocery and household-goods delivery service for one city (Kirkuk), sold through a phone app on the
App Store and Google Play. It is a **single seller**: the owner's own products, prices and drivers.
References the owner pointed to: Lezzoo Lokal (catalog with categories, brands, bulk offers) and
Ten Ten (single-store app with fast delivery).

Customers browse and build a cart in the app; the order is **saved in the system and sent to the shop on
WhatsApp**. The shop's staff confirm and run delivery from WhatsApp, as local shops already do. The app
keeps stock, prices and order history accurate behind that.

Research into similar one-city services (Breadfast, Picnic, Milkbasket vs. Gorillas/Getir/Dunzo) showed
that batched, scheduled delivery is what keeps a small own-driver fleet affordable. Hence two delivery
modes: fixed rounds plus a paid express option.

## 2. Goals (launch)

1. Customer app (iOS + Android) in Arabic, Kurdish (Sorani), Turkmen and English: browse ~500 products by
   category/brand, search, cart, then **"Send order on WhatsApp"**.
2. Every order is saved with an order number before WhatsApp opens; staff confirm or cancel it in the admin panel.
3. Two delivery types shown in the cart: **Regular** (joins the next fixed round the owner has set) and
   **Express** (higher fee).
4. Admin panel for products, photos, translations, stock in two warehouses, orders, round times, fees and
   the shop's WhatsApp number.
5. Published in both stores under the owner's personal developer accounts.

## 3. Non-goals for launch

- Driver app, dispatch, express pop-ups, driver cash tracking — staff handle delivery through WhatsApp.
- Customer accounts / SMS login — WhatsApp provides the customer's number.
- Online payment (ZainCash, FIB, FastPay, Qi Card) — cash on delivery only; keep room for a payment provider later.
- Offers engine beyond simple discounts, ratings/reviews, loyalty, push notifications.
- Third-party drivers, GPS tracking, multi-city, multi-vendor.

## 4. Anti-goals (would count as failure even if it "works")

- More than a couple of taps between the cart and WhatsApp opening; customers here expect very simple apps.
- Stock or prices in the app that don't match what the shop can actually deliver.
- Order totals that go up after the customer sends the order.
- Anything on the shared server that disturbs the live POS (see §7).

## 5. Decided behaviour

### 5.1 Customer flow
- Language picked on first launch, changeable in settings. Arabic and Kurdish right-to-left; Turkmen and English left-to-right.
- No sign-in. At the first order the customer enters name and phone number and drops a **map pin** plus a
  free-text **landmark** note ("near X mosque, blue gate"); the app remembers them on the device for next time.
- In the cart the customer picks **Regular** or **Express**. Regular shows which round it will join
  ("arrives with the 4 PM round"). No time picker.
- Tapping **Send order on WhatsApp**:
  1. the app saves the order (status *awaiting confirmation*) and gets an order number, e.g. `#1042`;
  2. WhatsApp opens to the shop's number with a pre-filled message: order number, items × quantity with
     prices, delivery type/round, delivery fee, total, name, phone, landmark and a map link of the pin;
  3. the customer presses send in WhatsApp.
- "My orders" in the app lists the orders sent from this device with their status.
- Payment: cash on delivery.

### 5.2 Products and pricing
- Every product has a fixed price in IQD. Fresh items (produce, meat, chicken) are pre-packed by the
  warehouse to exactly the weight listed (e.g. "1 kg beef"), so they are ordinary fixed-price products.
- ~500 products at launch, entered by the owner's staff. Initial load via spreadsheet import + photo folder.
- The store has **no connection to the POS** running on the same server: separate project, separate domain,
  separate catalog. Medusa is the only source of truth for products, prices and stock.

### 5.3 Warehouses
- Two warehouses, close together, carrying **different** products, each with its own stock.
- A product shows as available if its warehouse has stock.
- Mixed baskets: one driver collects from both warehouses and makes a single delivery (handled by staff).

### 5.4 Rounds, express and fees
- The owner defines fixed round times (e.g. 12:00, 16:00, 20:00) and a cut-off in the admin panel. A regular
  order joins the next round whose cut-off hasn't passed.
- Express: dispatched by staff as soon as they see it.
- Delivery across the whole city with **separate flat fees** for Regular and Express, set by the owner.

### 5.5 Staff side (admin panel)
- Orders list with status *awaiting confirmation → confirmed → delivered*, or *cancelled*; filter by round and
  by delivery type.
- Per-warehouse packing list for confirmed orders.
- *(Claude's call)* If an item can't be supplied, staff remove it from the order; the total can only go down.
  Staff tell the customer on WhatsApp. If all items are removed the order is cancelled.
- *(Claude's call)* Orders still *awaiting confirmation* after a set time (default 2 hours, editable) are
  cancelled automatically, so stock from carts that were never sent on WhatsApp is released.

## 6. Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | Medusa v2 backend + admin with small custom additions; Expo (React Native) customer app | Commerce core (products, IQD pricing, carts, orders, multi-warehouse stock, admin) is ready; one language (TypeScript) everywhere; owner owns all code; fits the existing server plan |
| B | Buy a white-label grocery app | Fast, but built for in-app checkout and on-demand drivers; WhatsApp ordering, rounds and Turkmen would mean modifying third-party code; licence fees |
| C | Custom backend (e.g. Supabase) + Expo | Full freedom, but cart/orders/stock/admin built from scratch |

Owner chose **A** on 2026-10-30. On 2026-11-17 the owner replaced in-app checkout, drivers and dispatch with
WhatsApp ordering ("saved and sent"). Owner delegated all tool choices to Claude; the owner builds with Claude Code.

## 7. Constraints

- **Timeline:** one month (agreed 2026-10-30). Cut extras in §9 first, never the anti-goals.
- **Store accounts (start immediately, outside the build):**
  - Apple Developer Program, personal account ($99/yr; seller shown as the owner's name). Can be converted
    to an organization later via Apple support.
  - Google Play, personal account ($25 once). New personal accounts must run a **closed test with ≥12 testers
    for 14 days** before production — testers = staff, drivers, family. Start it as soon as a first build works.
  - Try for a free D-U-N-S number with the local registration in parallel; don't block on it.
  - App review adds a few days per submission.
- **Server (shared with a live POS):** see `/var/www/store/CLAUDE.md` and `RESUME.md`. Summary: Linux user
  `medusa`, folder `/var/www/store` (+ staging folder), own Postgres role and DBs `medusa_db` / `medusa_staging`,
  own Redis DB index (never 0), ports 9000 prod / 9100 staging bound to 127.0.0.1, nginx in front with certbot,
  PM2 under `medusa`, builds under `nice -n 10`, `pg_dump -Fc` before prod migrations, deploy from git via
  GitHub Actions. Never touch POS processes, ports 3000/3001/4003, DBs pos_db/pos_branch_db or Redis DB 0.
- **Development:** on the owner's computer with Claude Code; this GitHub repo is the source of truth.

## 8. Technical decisions (Claude's calls, owner may override)

- **Repo:** monorepo — `apps/backend` (Medusa v2), `apps/customer` (Expo), `docs/`.
- **Backend:** latest Medusa v2, PostgreSQL 16, Redis (DB index 1 prod, 2 staging), Node 20.
  - Region "Iraq", currency IQD (no decimals).
  - Each warehouse = a Medusa stock location; each product's inventory lives at one location.
  - Orders are placed as guest orders through the normal cart → complete flow with Medusa's built-in manual
    payment provider (cash on delivery). The confirmation status is kept on the order (metadata or a small
    module); stock is reserved at placement and released on cancel.
  - Regular and Express = two shipping options with flat prices editable in admin.
  - **Delivery settings** (small custom module + admin page): round times, cut-off minutes, shop WhatsApp
    number, auto-cancel time. A store API endpoint returns the next round for the cart screen.
  - Admin extensions: confirm/cancel actions and round/type filters on orders, per-warehouse packing list.
  - Product content in 4 languages: use Medusa's built-in translation support if the installed version has it;
    otherwise a small translations module keyed by product/category and locale. Missing translation falls back to Arabic.
  - Product images on the server via Medusa's local file provider (included in server backups).
- **Customer app:** Expo (React Native, TypeScript), Expo Router, Medusa JS SDK, i18n with RTL switching,
  map pin picker (map provider: builder's choice, keep cost ≈ 0). WhatsApp opened with a `https://wa.me/<number>?text=…`
  link; message text in the customer's chosen language. Built and submitted with EAS.
- **Domains:** API and admin on subdomains of the owner's domain (TBD, §10).

## 9. Builder's calls (decide during planning)

- Extras if time allows: minimum order amount; "free delivery over X IQD"; express available hours;
  machine-drafted translations (Kurdish/Turkmen/English) that staff correct.
- Turkmen locale code and font coverage; map provider; exact screen list and layout; WhatsApp message layout
  and length handling for very large carts.
- Test strategy, CI, deploy script details (per the server plan in RESUME.md).
- Until the app name and domain are settled, build against a placeholder bundle ID and the staging subdomain.

## 10. Open items (owner)

- App/brand name customers see in the stores (repo is `chefs-app`) and domain(s).
- Shop WhatsApp number (a WhatsApp Business number is recommended).
- Success measure: what would show after the first months that it's working.
