# Grocery Delivery App — Design

Date: 2026-10-30 · Status: draft, awaiting owner approval

## 1. Intent

A grocery and household-goods delivery service for one city (Kirkuk), sold through a phone app on the
App Store and Google Play. It is a **single seller**: the owner's own products, prices and drivers.
References the owner pointed to: Lezzoo Lokal (catalog with categories, brands, bulk offers) and
Ten Ten (single-store app with fast delivery).

Research into similar one-city services (Breadfast, Picnic, Milkbasket vs. Gorillas/Getir/Dunzo) showed
that batched, scheduled delivery is what keeps a small own-driver fleet affordable, while pure
"instant" delivery loses money per order. Hence two delivery modes: cheap fixed rounds plus a paid express option.

## 2. Goals (launch, ~1 month from 2026-10-30)

1. Customer app (iOS + Android): browse ~500 products by category/brand, search, cart, checkout with
   cash on delivery, choose Regular or Express, see order status, in Arabic, Kurdish (Sorani), Turkmen, English.
2. Fixed delivery rounds set by the owner; regular orders join the next round automatically.
3. Express delivery: dispatched immediately to drivers for a higher fee.
4. Driver app where express orders pop up and round batches are listed.
5. Admin panel for products, stock, orders, rounds, drivers, fees and cash reconciliation.
6. Published in both stores under the owner's personal developer accounts.

## 3. Non-goals for launch (planned for v2)

- Online payment (ZainCash, FIB, FastPay, Qi Card) — design must allow adding it as a payment provider later.
- Third-party drivers / courier companies.
- Offers engine beyond simple discounts, ratings/reviews, loyalty, wallet, subscriptions.
- Live GPS tracking of drivers or nearest-driver assignment (only 3–4 drivers).
- Variable-weight pricing (not needed, see §5.2).
- Multi-city, multi-vendor marketplace.

## 4. Anti-goals (would count as failure even if it "works")

- A checkout that is more than a couple of taps beyond the cart; customers here expect very simple apps.
- Order totals that change after the customer places the order.
- Express orders that sit unseen because no driver noticed them.
- Anything on the shared server that disturbs the live POS (see §7).

## 5. Decided behaviour

### 5.1 Customers and ordering
- Sign-in with phone number + SMS one-time code (no passwords). Name required, email optional.
- Language picked on first launch, changeable in settings. Arabic and Kurdish right-to-left; Turkmen and English left-to-right.
- Address = map pin + free-text landmark note ("near X mosque, blue gate"). Delivery covers the whole city.
- At checkout the customer chooses only **Regular** or **Express**. No time picker.
- Payment: cash on delivery only at launch.

### 5.2 Products and pricing
- Every product has a fixed price in IQD. Fresh items (produce, meat, chicken) are pre-packed by the
  warehouse to exactly the weight listed (e.g. "1 kg beef"), so they are ordinary fixed-price products.
- ~500 products at launch, entered by the owner's staff. Initial load via spreadsheet import + photo folder.
- The store has **no connection to the POS** running on the same server: separate project, separate domain,
  separate catalog. Medusa is the only source of truth for products, prices and stock.
- *(Claude's call)* If an item can't be supplied at packing time, staff remove it from the order; the total
  can only go **down**, the customer gets a notification, and the driver app shows the corrected cash amount.
  No substitutions at launch. If an order loses all items it is cancelled.

### 5.3 Warehouses
- Two warehouses, close together, carrying **different** products, each with its own stock.
- A product is available if its warehouse has stock.
- Mixed baskets: **one driver collects from both warehouses** and makes a single delivery.

### 5.4 Delivery rounds (regular)
- The owner defines fixed rounds (e.g. 12:00, 16:00, 20:00) in the admin panel.
- A regular order joins the next round whose cut-off has not passed; the app tells the customer which round
  ("arrives with the 4 PM round").
- Staff assign each round's orders to drivers in the admin panel before departure.

### 5.5 Express
- Express orders pop up in the driver app for all available drivers; **first driver to accept gets it**.
- If nobody accepts within a few minutes, staff get an alert to dispatch manually.

### 5.6 Fees
- Delivery across the whole city with **separate flat fees** for Regular and Express, set by the owner.

### 5.7 Drivers
- 3–4 own drivers at launch. Driver app shows: express pop-ups, round batch list, which items to pick up at
  which warehouse, address/pin/landmark, amount of cash to collect, and a "delivered" action.
- Admin shows cash held per driver for end-of-day reconciliation.

## 6. Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | Medusa v2 backend + admin, custom modules for rounds/express/drivers; Expo (React Native) customer app; driver web app | Most to build, but commerce core (products, IQD pricing, carts, orders, multi-warehouse stock, admin) is ready; one language (TypeScript) everywhere; owner owns all code; fits the existing server plan |
| B | Buy a white-label grocery app | Fastest to a store listing, but built for on-demand; rounds, two-warehouse pickup and Turkmen would mean modifying third-party code; licence fees; vendor lock-in |
| C | Custom backend (e.g. Supabase) + Expo | Full freedom, but cart/orders/stock/admin built from scratch — not feasible in a month |

Owner chose **A** on 2026-10-30. Owner delegated all tool choices to Claude; the owner builds with Claude Code.

## 7. Constraints

- **Timeline:** one month. Scope in §2 is the ceiling; if time runs short, cut from §9 "Builder's calls"
  extras first, never from the anti-goals.
- **Store accounts (start immediately, outside the build):**
  - Apple Developer Program, personal account ($99/yr; seller shown as the owner's name). Can be converted
    to an organization later via Apple support.
  - Google Play, personal account ($25 once). New personal accounts must run a **closed test with ≥12 testers
    for 14 days** before production — testers = staff, drivers, family. The test must start by ~day 14.
  - Try for a free D-U-N-S number with the local registration in parallel; don't block on it.
  - App review adds a few days per submission.
- **Server (shared with a live POS):** see `/var/www/store/CLAUDE.md` and `RESUME.md`. Summary: Linux user
  `medusa`, folder `/var/www/store` (+ staging folder), own Postgres role and DBs `medusa_db` / `medusa_staging`,
  own Redis DB index (never 0), ports 9000/8000 prod and 9100/8100 staging bound to 127.0.0.1, nginx in front
  with certbot, PM2 under `medusa`, builds under `nice -n 10`, `pg_dump -Fc` before prod migrations,
  deploy from git via GitHub Actions. Never touch POS processes, ports 3000/3001/4003, DBs pos_db/pos_branch_db or Redis DB 0.
- **Development:** on the owner's computer with Claude Code; this GitHub repo is the source of truth.

## 8. Technical decisions (Claude's calls, owner may override)

- **Repo:** one monorepo — `apps/backend` (Medusa v2), `apps/customer` (Expo), `apps/driver` (driver web app), `docs/`.
- **Backend:** latest Medusa v2, PostgreSQL 16, Redis (DB index 1 prod, 2 staging), Node 20.
  - Region "Iraq", currency IQD (no decimals).
  - Each warehouse = a Medusa stock location; each product's inventory lives at one location. Mixed orders get
    one fulfillment per location; both are attached to the same delivery job.
  - Cash on delivery = Medusa's built-in manual payment provider; captured when the driver marks delivered.
  - Regular and Express = two shipping options with flat prices editable in admin.
  - **Rounds module** (custom): round schedule (weekday, departure time, cut-off minutes), generated round
    instances, assignment of orders to the next open round at order placement.
  - **Dispatch/driver module** (custom): drivers, availability (on/off shift), delivery jobs, job states
    (`offered → accepted → picked_up → delivered | failed`), atomic first-accept, accept timeout → admin alert,
    cash collected per job.
  - **Phone OTP auth** (custom auth provider) for customers and drivers. SMS gateway: see §10.
  - Admin extensions (Medusa admin UI routes/widgets): Rounds board (orders per round, assign driver),
    Express queue, Drivers & cash, Delivery settings (rounds, fees, express hours, minimum order),
    per-warehouse packing list.
  - Product content in 4 languages: use Medusa's built-in translation support if the installed version has it;
    otherwise a small translations module keyed by product/category and locale. Missing translation falls back to Arabic.
  - Product images on the server via Medusa's local file provider (included in server backups).
- **Customer app:** Expo (React Native, TypeScript), Expo Router, Medusa JS SDK, i18n with RTL switching,
  map pin picker (map provider: builder's choice, keep cost ≈ 0), Expo push notifications for
  order confirmed / out for delivery / delivered. Built and submitted with EAS.
- **Driver app:** installable web app (PWA) served by nginx as static files, not via the stores.
  Alerts: web push + loud in-app sound while open; polling fallback. Note: iPhone web push needs iOS 16.4+
  and the app added to the home screen; Android Chrome works directly.
- **Domains:** API, admin and driver app on subdomains of the owner's domain (TBD, §10).

## 9. Builder's calls (decide during planning)

- Suggested extras if time allows: minimum order amount; "free delivery over X IQD"; express available hours;
  machine-drafted translations (Kurdish/Turkmen/English) that staff correct.
- Turkmen locale code and font coverage; which map provider; exact screen list and layout;
  express accept timeout length; round capacity limits (if any).
- Test strategy, CI, deploy script details (per the server plan in RESUME.md).

- *(Claude's call)* Until the SMS provider, app name and domain are settled, build against stand-ins:
  a development OTP provider (fixed code in dev/staging only), a placeholder bundle ID, and the staging
  subdomain. These must be final by ~day 12 so the Google closed test can start on time.

## 10. Open items (owner)

- Success measure: what would show after the first months that it's working.
- SMS provider for login codes in Iraq.
- App/brand name (repo is `chefs-app`) and domain(s).
