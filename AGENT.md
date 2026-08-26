# AGENT.md — Lickyeat / TBC App

This file exists so any AI model (or human) picking up this repo cold can understand what has
been built, why, and how to keep working on it without re-deriving decisions that are already
settled. It is a living document — update it whenever you finish a body of work, the same way you'd
update a teammate.

**If anything here conflicts with the actual code, the code wins.** This file can go stale; treat
every claim below as "true as of the last time someone updated this file," not as guaranteed
current fact. When in doubt, grep for it.

---

## 1. What this project is

**Lickyeat** is a food-delivery mobile app + backend + admin dashboard, built from scratch as a
**standalone rebuild** — no shared code with any pre-existing website. It serves **three
independent brands** under one umbrella app:

| Brand | brandId | What it is | Ordering model |
|---|---|---|---|
| The Blenders Club | `tbc` | Shakes & mocktails cloud kitchen | Cart → checkout, "quick delivery" |
| The Alchemy Tails | `alchemy-tails` | Cocktail-style mocktails cloud kitchen | Cart → checkout, "quick delivery" |
| GG Tiffin Service | `gg-tiffin` | Home-style daily tiffin (breakfast/lunch/dinner) | Weekly/monthly **subscriptions**, or one-off **single-meal** orders — no cart |

TBC and Alchemy Tails share one cart/checkout/order system. GG Tiffin is structurally **completely
separate**: its own Mongoose models, its own service/controller files, its own mobile screens, and
it **never** touches the `Order` model or the regular checkout flow. This separation is deliberate
and load-bearing — several features (loyalty counter, cancellation policy, coupons — see §4.2) rely
on GG Tiffin never appearing in the regular-order code path. Don't blur this line without updating
everything that depends on it.

Business is based in Patna, Bihar, India. Delivery zone is currently a hardcoded single-city check
(`apps/api/src/modules/orders/deliveryZone.ts`) — no real geocoding/maps API is configured.

---

## 2. Repo layout & tech stack

pnpm workspaces + Turborepo monorepo at `d:\TBC app`.

```
packages/
  pricing/         Pure, zero-I/O business-logic package (pricing, discounts, rewards, recommendations)
  shared-types/     Zod schemas + inferred TS types, shared by api/mobile/admin — the single source
                     of truth for every request/response/DB-document shape
apps/
  api/             Express + Mongoose + TypeScript backend
  mobile/          React Native (Expo managed) customer app
  admin/           React + Vite staff dashboard (plain web app, not React Native)
```

- **Auth**: bcrypt password hashing + JWT (`apps/api/src/modules/auth`). Login/signup accept email
  or phone. Rate-limited (`signupRateLimiter`: 5 signups / 15 min per IP — matters when writing
  integration tests that create many users in one file).
- **Payments**: Razorpay, HMAC-SHA256 signature verification server-side
  (`apps/api/src/modules/payments/verifySignature.ts`). COD is trusted immediately; Razorpay orders
  only count as "paid"/complete after signature verification succeeds — this COD-vs-Razorpay split
  shows up repeatedly (loyalty counter advancement, WhatsApp alerts, refund eligibility).
- **WhatsApp**: Meta Business Cloud API, fail-silent if unconfigured (`apps/api/src/integrations/whatsapp`).
- **DB**: MongoDB via Mongoose. Local dev uses `mongodb-memory-server` (see §7), not a real Mongo
  install — **data does not persist across restarts of the dev Mongo process.**
- **Testing**: Vitest everywhere. `apps/api/__tests__/{unit,integration}`,
  `packages/pricing/__tests__`, `apps/mobile/__tests__` (mobile only has a couple of
  logic/store tests — no component/rendering tests, no on-device automation in CI).

Every request/response DTO and every Mongoose-document-shape lives in `packages/shared-types` as a
zod schema, imported by both `apps/api` (validation + Mongoose model shape) and `apps/mobile`
(TypeScript types for API calls). **Any schema change requires rebuilding shared-types**
(`pnpm --filter @tbc/shared-types build`) before the API's dev server (which imports the built
`dist/`, not the source) will see it — a very common gotcha, see §7.

---

## 3. Core architectural conventions (read before changing pricing/orders/tiffin code)

These are established patterns, not accidents. Follow them rather than reinventing per-feature:

1. **Never trust a client-submitted price.** `CreateOrderRequestSchema`/cart line schemas have no
   price fields at all — prices are always resolved server-side from the DB
   (`apps/api/src/modules/pricing/priceResolver.ts`) and the pure pricing engine
   (`packages/pricing`). The mobile cart's live total preview calls the *exact same*
   `computePricing()` function so it can't structurally drift from what the server charges.

2. **`packages/pricing` is a pure, brand-agnostic, I/O-free package.** It takes plain data in
   (`CartLineInput[]`, `LoyaltyState`, booleans like `isLoggedIn`) and returns a `PricingResult` —
   no DB calls, no brand-specific hardcoding inside. Callers resolve brand/DB-specific meaning into
   plain booleans/numbers before calling in (e.g. a coupon's discount amount is resolved via a DB
   lookup by the caller, then passed in as `couponDiscountAmount`). Keep it this way; it's what
   makes the package trivially unit-testable and keeps mobile/API pricing in lockstep.

3. **Snapshot, don't reference, at order/purchase time.** Dish names, add-on prices, delivery-fee
   waivers (`isPremiumMemberAtOrder`), etc. are copied onto the order document at creation time,
   never recomputed live from current data later. A later menu/price/plan edit must never
   retroactively change what a past order shows or was charged. This pattern repeats across
   regular orders, tiffin subscriptions, and tiffin single-meal orders — preserve it in any new
   order-like feature.

4. **`accessToken` is a capability, not just an identifier.** Guest (and logged-in) order status
   lookup and cancellation both work via `Order.accessToken` with **no auth check** — possessing
   the token is the authorization. This is deliberate (guests have no account to authenticate
   with), not an oversight. Don't add an auth requirement to accessToken-based routes without
   reconsidering the whole guest-order UX.

5. **Two independent order universes, never cross-called:**
   - Regular (`Order` model, `apps/api/src/modules/orders/`) — TBC + Alchemy Tails only.
   - Tiffin (`TiffinSubscription`/`TiffinSingleMealOrder` models, `apps/api/src/modules/tiffin/`) —
     GG Tiffin only.
   Each has its own delivery-partner pool, its own cancellation/refund policy, its own status enum,
   its own mobile tracking screen. When asked to add a feature to "order tracking" or "the offer
   system," check whether it should apply to one, the other, or both — don't assume.

6. **Cart lines carry their own `brandId`** (`apps/mobile/src/state/cartStore.ts`), fixed at
   add-time. Checkout derives the order's brand from the cart's own lines, never from whichever
   brand happens to be ambiently "selected" in the UI at that moment (the Home carousel auto-
   rotates the selected brand in the background without touching the cart — relying on ambient
   selection at checkout time caused a real bug where orders were submitted under the wrong brand
   and rejected server-side; see git history "brand mismatch" fix). If you add a new way to build a
   cart line, make sure it sets `brandId`.

7. **Multiple discount reasons are declared independently in up to 4 places** and must be kept in
   sync by hand: `packages/pricing/src/types.ts` (`DiscountReason` TS union),
   `packages/shared-types/src/order.ts` (`DiscountReasonSchema` zod enum),
   `apps/api/src/db/models/Order.model.ts` (Mongoose `enum: [...]`), and
   `apps/mobile/src/components/PriceBreakdown.tsx` (`DISCOUNT_LABELS` — TypeScript's exhaustiveness
   check on this `Record` will force a compile error if you forget it, which is the main safety
   net here). Same pattern applies to `RewardReasonSchema`/reward labels.

---

## 4. Feature inventory

### 4.1 Menu, cart, checkout (TBC / Alchemy Tails)
Standard browse → add to cart (with sugar/ice/add-on customization) → cart preview (live pricing)
→ checkout (delivery address + payment method) → order placed → order status screen. Guest
checkout supported (no account required); logged-in checkout snapshots the account's identity.
Combos: curated (fixed pair of items) and "choose your own N" — always priced live as 15% off the
constituent items' current base prices, never a stored bundle price (`computeComboPrice`). One
special cross-brand combo (`CROSS_BRAND_ID = "cross-brand"`) can mix items from any live brand.

### 4.2 Pricing / discounts / rewards (`packages/pricing`)
Current formula, in precedence order (see `computePricing.ts`):
1. **Premium member** (15+ completed orders, or admin override) → flat 25% off non-combo subtotal,
   plus free delivery within a self-reported distance-from-shop placeholder radius.
2. **Quantity-tier discount** (fallback when the above doesn't apply): 1 item→0%, 2→10%, 3→15%,
   4+→20%, on the non-combo subtotal, guests and registered users alike.

(A first/second-order "new-customer offer" — BOGO on order #1, 50% off order #2 — previously lived
here at this precedence step; it was removed entirely per a later product decision. If a similar
one-time acquisition perk is ever reintroduced, `git log` on `packages/pricing/src/` around its
removal has the full original implementation for reference.)

Separately (stacks additively on top of whichever discount above applies, doesn't replace it):
**milestone rewards**, registered users only, repeating every 10 orders — order #6/16/26/...→50%
off the cheapest cold-coffee unit; order #10/20/30/...→cheapest eligible drink entirely free.

Also separate and additive: a **coupon code** (`apps/api/src/modules/coupons/`), applied via
the Cart screen's "Apply Coupon" flow — percent or flat rupee amount, validated server-side against
`minOrderAmount`/`brandId`/`expiresAt`/`isActive`, applied last (after the discount/reward above,
before tax) via `PricingInput.couponDiscountAmount`. Never trust a client-sent discount amount —
`orders.service.ts` re-resolves the code server-side at order-creation time too.

Delivery fee: free at subtotal ≥ ₹499, OR premium-tier + within radius, OR an active **paid Premium
Membership** (see §4.3, independent mechanism), else ₹39 flat. Tax is flat 5% on
`subtotal - discountAmount - rewardAmount - couponDiscount`.

A `salePercent` field on individual MenuItems gives a small number of items their own markdown,
independent of and stacking with all cart-level discounts.

**All of this is unit-tested exhaustively** in `packages/pricing/__tests__/` — that's the
authoritative worked-examples reference for edge cases, more trustworthy than prose (including
this file).

### 4.3 Premium Membership (separate from the loyalty "premium" tier above!)
A **purchased**, time-limited membership (`packages/shared-types/src/premiumMembership.ts`,
`apps/api/src/modules/premiumMembership/`) — currently ₹21 for 60 days. Razorpay-only (COD was
deliberately removed once the feature was validated). Waives delivery fee outright regardless of
distance/subtotal/order count. Fully independent of the loyalty-tier "premium member" status
above — a customer can have one, both, or neither. Mobile Home screen shows Active/Expired status
on the carousel promo card, plus a proactive "expiring in ≤2 days" reminder popup.

### 4.4 GG Tiffin — subscriptions
Weekly (7-day) or monthly (30-day) plans, veg or non-veg, single/twice/thrice-daily meal styles.
Always **Regular tier** (Mini/Premium tiers are single-meal-order-only, see §4.5). Real curated
weekly menu (`TIFFIN_REGULAR_VEG_MENU` etc. in `packages/shared-types/src/tiffin.ts`) — a specific
dish per day per meal type, with specific non-veg-day overrides (a real tiffin service doesn't
serve meat every day). Subscriptions can be paused/resumed, individual days skipped/unskipped, and
cancelled with a refund policy (`CANCELLATION_FULL_REFUND_WINDOW_DAYS`/`CANCELLATION_REFUND_PERCENT`
— full refund within the first 15 days, none after; weekly plans can't be cancelled at all).

### 4.5 GG Tiffin — single-meal ordering (no subscription)
"Order a Single Meal" — pick tomorrow's (or today's, if before the meal's ordering cutoff, see
`mealOrderingWindow.ts`, IST-aware) breakfast/lunch/dinner, any of 3 tiers (Regular/Mini/Premium) ×
2 diets, pay once. Dish resolution (`apps/api/src/modules/tiffin/singleMealMenu.ts#getSingleMealDish`)
mirrors the subscription menu exactly for Regular tier, with tier-specific non-veg override days.

- **Dish names shown as bare names** (e.g. "Aloo Gobhi") in checkout/order-history/tracking, but
  the three menu-*browsing* screens (subscription plan preview, Weekly Menu, Order Single Meal's
  card list + customize popup) display a **composed full name** ("Rice Roti Daal Aloo Gobhi",
  "Rice Paratha Daal ..." for Premium, "Pulao Paratha Daal ..." for Premium's two Sunday upgrades)
  via `composeFullDishName()` in `apps/mobile/src/utils/tiffinDishForDay.ts`. This is a
  **display-only transform** — it does not touch the underlying API `dishName` field, the add-ons
  system, or checkout/tracking. This went back and forth once already (composed→removed→re-added
  in a different, narrower scope) — don't "simplify" it back to one or the other without checking
  which screens were actually asked for.
- **Real, individually-priced add-ons** (`resolveAddOns()` in `singleMealMenu.ts`): Rice, Roti,
  Daal (all three now offered for every tier including Mini, even though Mini's own *included*
  meal is just roti+sabzi), Paratha/Pulao for Premium, and an "Extra {dish}" or "{Protein} piece"
  add-on. These are optional, customer-selected in a customize pop-up, and priced separately from
  the base meal — never bundled into the dish name or auto-included. Server re-derives/re-prices
  selected add-ons from the same catalog at order time, never trusts client-submitted add-on
  prices (same "never trust the client" principle as §3.1).
- **Images**: `apps/api/src/modules/tiffin/singleMeal.service.ts#resolveDishImageSlug` — checks a
  Mini-specific photo first, then a shared Regular/Premium photo, then falls back to one of three
  generic tiffin-box photos (`veg-tiffin`/`non-veg-tiffin`/`mini-tiffin`/`breakfast-tiffin`) chosen
  from **what the resolved dish actually is** (checked against the known protein-dish list), never
  from which diet tab the customer happens to be viewing — a real bug (non-veg tab showing a
  chicken-curry stock photo next to a vegetarian fallback dish) was found and fixed this way. A
  handful of dishes (Aloo Parwal, Lauki Masala, Matar Chole, Upma, plain Chicken Curry outside
  Mini) genuinely have no dedicated photo anywhere in the source material
  (`D:\Menu pics and names` — the real source folder for every tiffin/menu image asset; check
  *there*, not just `apps/api/public/tiffin-images/`, before concluding an image is missing) — they
  use the generic fallback and that's expected, not a bug, unless new photos are supplied.
- **Quantity**: customer can order more than one of the same customized meal in one go
  (`MAX_SINGLE_MEAL_QUANTITY`).
- **"Veg Only" toggle**: a single persisted preference (`apps/mobile/src/state/tiffinPreferencesStore.ts`)
  shared across all three GG Tiffin screens (landing, weekly menu, single-meal ordering) — flipping
  it hides non-veg everywhere at once, not per-screen.

### 4.6 Order tracking, delivery partners, cancellation (both order universes)
Both regular orders and tiffin single-meal orders now have near-identical tracking screens:
status timeline, an embedded map (see below), a delivery-partner card with one-tap Call/Text, and
a cancel button with an in-context policy explanation.

- **Delivery partner**: assigned from a small **fixed demo pool** (there is no real rider
  app/dispatch system) the moment an order (admin-driven) transitions to `out-for-delivery` —
  `pickDeliveryPartner()`, deterministic by order id, in `admin.controller.ts` (regular orders) and
  `singleMeal.service.ts` (tiffin orders) — **two separate pools**, kept independent on purpose.
- **Map**: an embedded Google Maps view via a **WebView loading a local HTML document containing a
  real `<iframe>`** (`apps/mobile/src/utils/mapEmbed.ts`) — Google's free keyless embed URL refuses
  to render if loaded directly as a WebView's top-level source ("must be used in an iframe"); this
  workaround fixes that without needing an API key. Shows the delivery **address**, not a live
  moving rider position — there's no real GPS feed to plot one from.
- **Cancellation refund tiers** — **different rules for the two order universes**, don't conflate
  them:
  - *Regular orders* (`ORDER_CANCELLATION_DISPATCHED_REFUND_PERCENT`/`..._DELIVERED_REFUND_PERCENT`
    in `shared-types/order.ts`): full refund while still `received`; 50% while `preparing`/
    `out-for-delivery`; 30% if cancelled **after** `delivered` (a post-delivery complaint — spilled,
    never arrived — with an optional free-text reason).
  - *Tiffin single-meal orders* (`SINGLE_MEAL_CANCELLATION_WINDOW_MINUTES` in `shared-types/tiffin.ts`):
    simple time-based — full refund if cancelled within 15 minutes of placing the order, none after.
  - Refunds are **never actually processed through Razorpay** — the system just records the
    entitled refund amount and flips `payment.status` to `"refunded"`, for the business to settle
    manually (Phase-1 approach, same as the tiffin-subscription cancellation refund).
  - Refund is only ever non-zero if `payment.status === "paid"` — COD orders never had money
    collected upfront, so cancelling one is always a ₹0 refund regardless of timing/status.
- **App-wide "active order" pills**: a small floating chip stack
  (`apps/mobile/src/components/ActiveOrderPills.tsx`), mounted once at the root navigator (not
  per-screen), showing whichever regular and/or tiffin orders are still in flight — tap to jump
  straight to that order's tracking screen. If more than one order of a kind is active at once, the
  chip shows a count and opens a picker instead of guessing which one you meant. Hidden on the
  order-tracking screens themselves (redundant there). Positioned near the screen footer.
  Tracking a route's current name from *outside* the navigator tree (this component isn't a
  descendant of the `Stack.Navigator`) requires the `navigationRef`'s own `"state"` listener, not
  the usual `useNavigationState` hook — that hook throws if used outside the navigator subtree.
- **COD cancellation auto-redirect**: cancelling a COD order (either universe) shows "Redirecting
  to home page in 3 seconds…" and auto-navigates home — there's nothing left to review on a COD
  order's page (no refund confirmation to read), unlike a Razorpay order where the refund amount
  stays visible.

### 4.7 Admin app (`apps/admin`)
Plain React+Vite SPA (not React Native) — order list/filter/status-advance for regular orders,
tiffin subscriptions/single-meal-orders/deliveries management (`TiffinDeliveriesPage.tsx`),
WhatsApp-recommendation trigger, meal-price management. This is also the **only** way to advance an
order to `out-for-delivery` (and thus assign a delivery partner) — there's no customer-facing way
to simulate that state, which matters when testing/demoing the tracking screens.

---

## 5. What's explicitly deferred / not done

- No real geocoding — delivery-zone and distance-from-shop are both self-reported/hardcoded
  placeholders, not real geolocation.
- No real rider/dispatch system — delivery partners are a fixed fake pool, not live people.
- Refunds are recorded, never actually pushed through Razorpay's refund API.
- WhatsApp templates are placeholder names pending real Meta Business template approval.
- A handful of tiffin dishes have no dedicated photo (see §4.5) — pending real photos from the
  business.
- No CI on-device UI test automation — Vitest covers logic only; on-device verification is manual
  (see §7.3).
- Hosting/deployment: recommended but not provisioned (Render for API, Atlas for Mongo, EAS Build
  for the mobile app stores) — nothing is actually deployed anywhere yet.
- Run `git status` before assuming HEAD reflects everything described here — this doc is kept
  up to date deliberately, but working-tree state can still drift ahead of it mid-session.

---

## 6. "Mostly Ordered" home-screen section — open, deferred request
A user request to add a "Mostly Ordered" row (before "Recommended For You," populated once a
customer has placed at least one order, for all three brands) was raised mid-conversation and
**explicitly deferred, not completed**. Note: `HomeCollections.tsx` already has an existing
"Mostly Ordered" row wired up for TBC/Alchemy Tails from order history — it's unclear whether that
already satisfies the request or whether GG Tiffin's own home rows
(`TiffinHomeCollections.tsx`) also need one. Investigate before assuming either way; don't start
from scratch without checking what's already there.

---

## 7. Local dev environment (Windows, this machine)

This has been the single biggest source of wasted turns in past sessions — read this before
touching the mobile app.

### 7.1 One-time setup facts
- Real Android SDK is at `D:\SDK location` — **not** the default
  `C:\Users\ASUS\AppData\Local\Android\Sdk`.
- The `Pixel_7` AVD's data lives at `D:\AndroidAVDs\Pixel_7.avd` (moved off a nearly-full C: drive).
- No real MongoDB install — local dev uses `mongodb-memory-server` via
  `apps/api/scripts/dev-mongo.ts` on a **fixed port 27117**, dbName `tbc`. `apps/api/.env` already
  points at it. **This is in-memory — every time you restart the dev-mongo process, the database
  is completely empty again.** Re-seed with `pnpm run seed` (in `apps/api`) after every restart, or
  the app will show empty brands/menus/combos and looks badly broken for reasons that have nothing
  to do with your code changes.
- Real menu/tiffin images and their original filenames live at `D:\Menu pics and names` — check
  there first when asked about a missing or wrong image, don't assume `apps/api/public/*-images/`
  is the complete/authoritative set (it's a copy, and copies can lag).

### 7.2 Bringing the whole stack up from cold
Order matters — API will crash-exit if Mongo isn't listening yet when it starts:
```bash
# 1. Mongo first, wait for it
cd apps/api && pnpm run dev:mongo   # background; wait for port 27117 to listen
# 2. Seed (every time Mongo was restarted!)
pnpm run seed
# 3. API
pnpm run dev                          # background; wait for GET /health to return {"ok":true}
# 4. Metro bundler
cd ../mobile && npx expo start        # background; wait for "Waiting on http://localhost:8081"
# 5. Emulator (can run in parallel with 1-4)
"/d/SDK location/emulator/emulator.exe" -avd Pixel_7
# wait for `adb wait-for-device shell 'while [[ -z $(getprop sys.boot_completed) ]]; do sleep 2; done'`
# 6. Port forwarding (needed again after every emulator restart)
adb reverse tcp:4000 tcp:4000
adb reverse tcp:8081 tcp:8081
# 7. Launch (Expo Go is already installed on the AVD image)
adb shell am force-stop host.exp.exponent   # guarantees a genuine cold reload, not a resumed stale task
adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081"
```
`expo start --android` and other flows that spawn interactive CLI prompts (version-mismatch,
port-in-use) hang forever with no TTY attached — always use plain `expo start` + the `am start`
intent above instead.

### 7.3 Verifying a change actually works
`pnpm run typecheck` and `pnpm run test` (from repo root, via Turborepo) passing is **necessary but
not sufficient**. Two real, non-trivial bugs in this project's history were only caught by actually
running the app on the emulator, not by the test suite (Express-4-swallows-async-errors;
`_id`-vs-`id` mismatch masking a "tapping any item opens the first item" bug) — see the git log for
detail. After any change touching API response shapes, async route handlers, or navigation/id
cross-references, reload the app and click through the affected screens before calling it done.

When tapping UI elements via `adb`, **don't eyeball screenshot coordinates** — the displayed
screenshot is scaled (900×2000 shown for a 1080×2400 real screen, a 1.2× factor) and estimates
routinely miss by 100-300px. Use `adb shell uiautomator dump` and read the exact `bounds="[x1,y1][x2,y2]"`
for the element, then tap its center in *real device* pixels. Remember to `am force-stop
host.exp.exponent` before relaunching whenever testing whether a just-made change actually took
effect — Android will otherwise resume the existing task with stale in-memory JS state, which looks
exactly like "the fix didn't work."

### 7.4 Package build order
`packages/shared-types` and `packages/pricing` are consumed by the API via their **built** `dist/`
output, not live source — after editing either package, run
`pnpm --filter @tbc/shared-types build` / `pnpm --filter @tbc/pricing build` (or just
`pnpm run typecheck`/`pnpm run test` from the root, which rebuilds them as a side effect via the
Turborepo task graph) before expecting the running `tsx watch` API dev server to see the change.

---

## 8. Keeping this file useful
When you finish a meaningful chunk of work: add or update the relevant section above rather than
letting this file drift. Prefer editing an existing section over appending a new "recent changes"
list at the bottom — this file describes *current state*, not a changelog (git history is the
changelog).
