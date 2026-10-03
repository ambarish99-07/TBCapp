# AGENT.md — Lickyeat / TBC App

This file exists so any AI model (or human) picking up this repo cold can understand what has
been built, why, and how to keep working on it without re-deriving decisions that are already
settled. It is a living document — update it whenever you finish a body of work, the same way you'd
update a teammate.

**If anything here conflicts with the actual code, the code wins.** This file can go stale; treat
every claim below as "true as of the last time someone updated this file," not as guaranteed
current fact. When in doubt, grep for it.

---

## 0. Working process expectation: full research before answering, every time

When answering anything not already verified in this codebase — pricing, third-party service setup
steps, how an external platform's UI/API actually behaves, anything time-sensitive — **do full
research first** (fetch the real page/docs, don't answer from memory) and give the complete,
accurate picture in one pass rather than a partial answer that turns out wrong or incomplete on a
follow-up question.

Confirmed mistakes this caused before this instruction existed: claiming Zoho Mail has a usable
free tier for a custom domain (it doesn't support custom domains on free, and even the "forever
free" tier excludes IMAP/POP, making it effectively unusable in a normal mail app); saying MSG91's
DLT registration happens inside MSG91's own dashboard when it actually happens on a separate
telecom-operator portal (SmartPing/VILPower) and only gets *mapped* back into MSG91 afterward.

**Why this matters:** the user follows these answers as literal, sequential, real-world
instructions (registering a business domain, setting up a payment gateway, going through DLT
compliance) — an incomplete or wrong answer isn't just "corrected next message," it means real
wasted time, money, or steps taken in the wrong order, and breaks the ability to work through a
checklist step by step without hitting dead ends.

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
  mobile/          React Native (Expo) customer app — managed workflow, except for one native
                   module (react-native-razorpay, see §5); needs a Dev Client build, not Expo
                   Go, to actually open the Razorpay checkout sheet
  admin/           React + Vite staff dashboard (plain web app, not React Native)
```

- **Auth**: bcrypt password hashing + JWT (`apps/api/src/modules/auth`). Login/signup accept email
  or phone. Rate-limited (`signupRateLimiter`: 5 signups / 15 min per IP — matters when writing
  integration tests that create many users in one file).
- **Payments**: Razorpay, HMAC-SHA256 signature verification server-side
  (`apps/api/src/modules/payments/verifySignature.ts`). COD is trusted immediately; Razorpay orders
  only count as "paid"/complete after signature verification succeeds — this COD-vs-Razorpay split
  shows up repeatedly (loyalty counter advancement, WhatsApp alerts, refund eligibility). Server
  side (create-order + verify, across all four payment surfaces: Cart orders, Tiffin monthly
  plans, Tiffin single-meal, Premium Membership) has been complete since early in the project.
  Client side, the actual checkout sheet (`apps/mobile/src/utils/razorpayCheckout.ts`,
  `react-native-razorpay`) is now wired for real too — it was a placeholder that just showed an
  alert until 2026-09-04. `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` in `apps/api/.env` are still
  unset (no real Razorpay account credentials exist yet), so nothing has been paid for through it
  end-to-end — and even once keys are added, testing it live needs an Expo **Dev Client** build,
  not Expo Go (react-native-razorpay is a third-party native module; Expo Go can't load it). The
  `require()` inside `launchRazorpayCheckout` is deliberately lazy so Expo Go keeps working for
  everything else in the meantime — see that file's own comment for why a static import would
  crash the whole app on launch instead.
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

### 4.1 Menu, cart, checkout (TBC / Alchemy Tails / any catalog brand)
Standard browse → add to cart (sugar/ice/size/add-on customization, all independently optional per
item — see §4.10 for size variants and stock toggles) → cart preview (live pricing) → checkout
(delivery address + payment method) → order placed → order status screen. Guest checkout supported
(no account required); logged-in checkout snapshots the account's identity. Whether a brand is
even orderable right now is a separate, earlier gate — see §4.8.
Combos: curated (fixed pair of items) and "choose your own N" — always priced live as 15% off the
constituent items' current base prices, never a stored bundle price (`computeComboPrice`).

**Multi-kitchen orders + Feast combos (2026-10-02).** All kitchens share one location, so ONE cart/order
can mix kitchens (one delivery, one payment). The server derives each line's kitchen from the DB
(`ResolvedCartLine.brandId`; client never sends a brandId), stores `Order.brandIds` (all kitchens;
`brandId` = first), requires EVERY kitchen in the order to be open (error names the closed one), and a
kitchen-specific coupon applies if that kitchen is in the cart (discount math unchanged — owner still to
decide coupon/discount rules for mixed orders). The old single cross-brand combo is gone; "Feast" combos
use `FEAST_COMBO_BRAND_ID = "feast"`. Each Feast has a `feastSize` (`FEAST_SIZES`: For One / For Two /
For Four / Party — the Feast page's tabs); each size has ready-made Feasts plus its own choose-n
build-your-own (3 / 5 / 8 / 12 picks) whose empty `eligibleItemIds` = any item from any open kitchen,
so new brands join automatically. Feast picks MAY repeat an item (a brand's own pick-N still may not);
combo lines snapshot their contents as e.g. "3× Chicken Biryani + Coffee Chill" for the kitchen. Definitions:
`apps/api/src/db/feastCombos.ts`; write them to a live DB with `pnpm --filter @tbc/api sync-feast-combos`
(combos only). Mobile: home bottom-bar "Feast" button → `FeastScreen`; admin: sidebar "Feast Combos".
The website mirrors all of this (`/feast` page, `GET /menu/feast`, its own `sync-feast-combos` script;
the website admin has no combo editor).

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
Weekly (7-day) or monthly (30-day) plans, veg or non-veg. Each `TiffinPlan` carries a **tier**
(Regular/Mini/Premium — same three tiers as single-meal ordering, §4.5; `tier` defaults to
"regular" for backward compatibility with plans created before the field existed) and a **style**:
`single` (customer picks breakfast/lunch/dinner at subscribe time), `twice-daily` (lunch+dinner,
fixed), `thrice-daily` (all three, fixed), or `lunch-only`/`dinner-only` (one fixed meal, sold as
its own catalog entry, no customer choice needed — distinct from picking that same meal via
`single`). Mini has no breakfast dish configured anywhere in the system, so it only ever offers
`twice-daily` or a `single`/`lunch-only`/`dinner-only` plan restricted to lunch/dinner — both
`createPlan`/`updatePlan` (admin) and `createSubscription` (subscribe time) reject a
tier/style/mealType combination that would need a breakfast dish Mini doesn't have
(`tiffin.service.ts#assertValidTierStyle`, `#TIER_MEAL_TYPES`). Dish resolution for a subscription
now builds a per-tier lookup (`tiffinSchedule.ts#buildDishLookupForTier`, snapshotted onto the
subscription's own `tier` field at subscribe time) instead of always assuming Regular.
**Razorpay-only** — Cash on Delivery was removed entirely for subscriptions (weekly and monthly
alike; a same-day single-meal order still allows COD). Real curated weekly menu, one row per
(tier, dietType, mealType, dayOfWeek) in the `TiffinDish` collection (`tiffinDishSeedData.ts`) — a
specific dish per day per meal type, with specific non-veg-day overrides (a real tiffin service
doesn't serve meat every day) and specific per-dish price overrides (`TiffinDish.price`, falls
back to the shared `TiffinMealPrice` slot price when unset). Subscriptions can be paused/resumed,
individual days skipped/unskipped, and cancelled with a refund policy
(`CANCELLATION_FULL_REFUND_WINDOW_DAYS`/`CANCELLATION_REFUND_PERCENT` — full refund within the
first 15 days, none after; weekly plans can't be cancelled at all). Mobile's Tiffin landing screen
filters the plan catalog by Weekly/Monthly tabs (`TiffinLandingScreen.tsx`) since the full catalog
across three tiers runs to ~30 plans.

### 4.5 GG Tiffin — single-meal ordering (no subscription)
"Order a Single Meal" — pick tomorrow's (or today's, if before the meal's ordering cutoff, see
`mealOrderingWindow.ts`, IST-aware) breakfast/lunch/dinner, any of 3 tiers (Regular/Mini/Premium) ×
2 diets, pay once (COD still allowed here, unlike subscriptions — a same-day order, not an
up-front commitment). Dish resolution (`apps/api/src/modules/tiffin/singleMealMenu.ts#resolveDishSlot`)
reads from the same per-tier `TiffinDish` rows a subscription of that same tier resolves against —
a subscription and a one-off order for the same tier/day/diet/meal never disagree.

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
Plain React+Vite SPA (not React Native). Sidebar is split into two halves:
- **LICKYEAT** — company-wide pages that span every brand: Dashboard, Analytics, Store Status
  (§4.8), Brands (the brand registry — create/edit logo/tagline/colors/status, the **only** entry
  point into a brand's own management), Orders, Customers (search or browse all, plus per-customer
  purchase-history-based recommendations and the persisted "Recommended For You" picker), Coupons,
  Bulk Orders, Reviews & Complaints.
- **A brand's own tabbed page** (`/brands/:brandId/...`), reached only via the Brands page's
  "Manage ›" button, not a sidebar entry per brand (deliberately — keeps the sidebar a fixed size
  no matter how many brands exist). Tabs are **Menu Items · Combos · Store Status** for a normal
  catalog brand, generated by one reusable component (`BrandTabsLayout`/`BrandTabs`) — a
  brand-new brand gets this automatically, no new code. GG Tiffin gets the same tabbed shell but
  with its own six tabs (Menu, Festival Specials, Plans, Deliveries, Meal Prices, Emergency
  Closure — §4.9), since it's a structurally different (subscription) system.

This is also the **only** way to advance a regular order to `out-for-delivery` (and thus assign a
delivery partner) — there's no customer-facing way to simulate that state, which matters when
testing/demoing the tracking screens.

### 4.8 Store-wide ordering availability (Lickyeat-wide switch + per-brand switch)
Two independent, identically-shaped systems (`apps/api/src/modules/storeSettings/`) controlling
whether **catalog brands** (TBC, Alchemy Tails, The Biryani Lane, any future one) can be ordered
right now. **Does not cover GG Tiffin at all** — it has its own separate cutoff/closure system
(§4.5, §4.9).
- **Lickyeat-wide** (`StoreSettings`, a singleton) — the parent-level switch. An absolute
  override: if it's closed, every catalog brand is closed no matter what its own settings say.
  Admin page: Store Status (under LICKYEAT in the nav).
- **Per-brand** (`BrandStoreSettings`, keyed by brandId, `getOrCreateBrandStoreSettings` upserts
  defaults on first read — a new brand needs zero setup) — the same shape (manual switch, daily
  service-hours schedule, planned closures) scoped to one brand, e.g. Blenders Club can close
  early on Sundays while Alchemy Tails stays open. Admin page: that brand's own Store Status tab.
  `getBrandStoreStatus()` in `brandStoreSettings.service.ts` is the one function that combines
  both levels (checks Lickyeat-wide first) — used both by the public `/brands/:brandId/status`
  endpoint and by `orders.service.ts`'s own order-creation enforcement, so display and enforcement
  can never disagree.
- **Planned closures** (`StoreClosure`/`BrandStoreClosure`) — announce a future date range ahead of
  time (a holiday, maintenance) rather than only blocking once it arrives; the mobile app shows a
  mild "heads up, closing soon" banner before the dates hit, then the same urgent "closed" banner
  once they do. No undo once declared.
- Mobile: `useStoreStatus(brandId)` in `apps/mobile/src/api/storeStatus.api.ts`, rendered via
  `StoreClosedBanner` on Home and at Cart checkout — skipped entirely while GG Tiffin is the active
  brand context.

### 4.9 GG Tiffin Emergency Closures
A separate, GG-Tiffin-specific closure system (`apps/api/src/modules/tiffin/tiffinClosure.service.ts`,
admin page: Emergency Closure tab) — not the same mechanism as §4.8, because GG Tiffin's own side
effects are different. Declaring a closure (start date, end date, optional reason) is a one-shot,
irreversible action that immediately:
- Marks every affected subscriber's scheduled meals in range `"closed"` and pushes that
  subscription's `endDate` out by the same number of days — a 30-day plan interrupted by a 2-day
  closure still delivers 30 days of meals, just over 32 calendar days
  (`computeMealsForRangeSkippingClosedDates` in `tiffinSchedule.ts` also makes a **brand-new**
  subscription skip already-declared closures from day one, so it never needs the retroactive fix).
- Auto-cancels, with a full refund, any single-meal order already placed for a date in range.
- Keeps blocking new single-meal ordering for those dates for as long as they're still upcoming
  (closed dates just disappear from `getSingleMealMenu`'s results).

### 4.10 Menu item portion sizes, size variants, and stock/availability toggles
`MenuItem` (`packages/shared-types/src/menu.ts`) now carries:
- `portionSize` (free text — "300 ml", "500 gm", whatever unit fits the brand) + the item's
  existing `price` as its **default size**.
- `sizeVariants: {label, price, isAvailable}[]` — extra sizes beyond the default (e.g. a 1kg
  option alongside a default 500g), each priced directly by the admin (not a multiplier/formula).
  Customer picks one in the same customize popup that shows sugar/ice/add-ons
  (`CustomizationFields.tsx`'s "Size" row, shown only when there's more than one size); the choice
  travels as `customization.selectedSizeLabel` and the server re-resolves the real price for
  whichever label was sent (`resolveSizeBasePrice` in `priceResolver.ts`) — never trusts a
  client-submitted price for a size, same principle as add-ons.
- `isAvailable` (whole item), and `isAvailable` on each size variant and on each shared
  `MenuAddOnPrice` catalog entry (add-on availability is **global**, not per-item, since running
  out of whipped cream is true everywhere it's offered) — three independent out-of-stock toggles.
  An unavailable thing is shown **struck through/disabled, not hidden** (`ItemMiniCard`,
  `MenuItemCard`, `AddOnSelector`, the size picker all do this) so a customer knows it exists but
  can't be ordered right now. Enforced server-side in `priceResolver.ts` regardless of what the
  client displays — including inside a combo's constituent items.
- Admin: the switch lives directly on each item's card in Menu Items (`isAvailable ?? true`
  defensive-fallback pattern everywhere on the client, since a document created before this field
  existed won't have it in storage — Mongoose doesn't backfill defaults on `.lean()` reads of old
  documents).

### 4.11 Brand catalog: coming-soon brands, logos, and future-brand readiness
`Brand` (`packages/shared-types/src/brand.ts`) carries `logoUrl`, `heroImageUrl`, `primaryColor`,
`accentColor`, `tagline`, and `status: "live" | "coming-soon"`. Logos are uploaded through the
Brands page (`POST /admin/brands/upload-image`, same multer pattern as menu/tiffin image uploads).
A `"coming-soon"` brand (e.g. **The Biryani Lane**, id `the-biryani-lane` — the first brand added
after TBC/Alchemy Tails/GG Tiffin, proof that the "new brand" path works) shows up on the mobile
Home screen's own "Coming Soon" section (`GET /brands/coming-soon`, `ComingSoonBrandBanner.tsx`) —
a static teaser card, non-orderable, with the same paging-arrow mechanism as Cart's "Add More From
[Brand]" row (dormant until there's more than one page of coming-soon brands). Nothing about the
menu/combo/pricing/customization system anywhere in this app assumes a fixed set of brands or
categories — `MenuCategorySchema` is free text, add-ons are a shared named catalog, and every
brand-scoped admin/mobile feature (Store Status, size variants, availability toggles, the brand
tabs page) is keyed by `brandId` and works identically for a brand created five minutes ago.

**New brand ids must be lowercase slugs** (`the-momo-house`) — enforced in `createBrand`, because the
id is shared with the website (4.12). The Biryani Lane's app id is the historic `TBL` (website:
`the-biryani-lane`); that one alias is built into catalog sync.

**Gharana Grills** (`gharana-grills`, added 2026-10-03): a full-menu North Indian + Indo-Chinese
kitchen — 35 dishes (rice bowls, breads, paneer, dal/veg, chicken/mutton/egg, Indo-Chinese),
curries in Half/Full sizes. Created as **coming-soon** with a plain placeholder photo and DRAFT
prices by `D:\Plan for app and website\scripts\add-gharana-grills.mjs` (re-runnable, goes through
the admin API so it syncs to the website). To launch: upload logo/banner/dish photos, review prices,
switch to Live — it then joins the Feast build-your-own automatically.

### 4.12 App ↔ website catalog sync (2026-10-03)
The two projects keep separate databases; `modules/catalogSync` in BOTH APIs keeps the catalog
identical. Every admin write to a brand, menu item, add-on, combo (incl. Feasts) or open/closed
switch is sent to the other API as a signed event (`POST /internal/catalog-sync`, HMAC-SHA256 over
the raw body + timestamp, 5-min window, shared `CATALOG_SYNC_SECRET`); the receiver applies it
directly to its models and never re-sends (no loops). Sends are fire-and-forget with 2 retries — an
admin save never fails because the other side is down. `catalogSync.types.ts` is the identical wire
format in both repos (canonical = website field names/brand ids; the app maps `image`↔`imageUrl`,
`TBL`↔`the-biryani-lane`, `displayOrder`↔`sortOrder`; relative website photo paths are resolved
against the peer URL). Shared settings are synced too, app → website only — see §4.15. App admin **Website Sync** page shows what differs and has "Push everything to website"
(optionally deleting website-only items/combos/add-ons; never brands). Config: `CATALOG_SYNC_PEER_URL`
+ `CATALOG_SYNC_SECRET` on both APIs (`.env.example`); off when unset (tests, plain local dev).
The website admin's menu page says to add/delete items in the app admin (it has no item editor).

### 4.13 Support assistant (chatbot) + Help Requests (2026-10-03)
`SupportChatScreen` ("Lickyeat Assistant") — a GUIDED chat, deliberately not an AI model: fixed,
tested flows over the customer's real data — track (ETA/late/rider), cancel (policy + refund shown
before confirming), problem with order (missing/wrong/spilled/quality/late → description → optional
photo), payment taken but not confirmed, refund status, kitchens open now, offers, delivery info,
Feast, my help requests, talk to a person. Typed text → `src/support/intents.ts` keyword matching
(English + common Hinglish, unit-tested); "my shake spilled" jumps straight to the right topic.
Entry points: Help & Support (top card) and Order Status ("Need help with this order?", starts with
that order). Problems become `SupportTicket`s (`modules/support`: `POST /support/tickets`,
`POST /support/photo` [own uploads only, 5 MB], `GET /support/tickets/mine`, 10/day/account) →
admin **Help Requests** page (payment issues on top, call/WhatsApp links, reply + status); the reply
shows in the customer's chat. Support phone/WhatsApp/email in
`apps/mobile/src/constants/support.ts` are still PLACEHOLDERS.

### 4.14 Combined admin: App / Website / Both (2026-10-03)
The website now has its own reviews & complaints (one per delivered order, "Rate / report" on My
orders), help requests and the same guided assistant on a new `/help` page (+ "Need help with this
order?" on its order page; contact buttons use the website's `WHATSAPP`/`LICKYEAT_SUPPORT_EMAIL`).
The app admin shows both storefronts: Analytics, Reviews & Complaints and Help Requests have an
**App / Website / Both** switch (`components/SourceSwitch.tsx`, remembered in localStorage);
Customers has App | Website (separate accounts) with a website customer detail page. Mechanism:
the website exposes signed `/internal/admin-peer/*` endpoints (same HMAC + `CATALOG_SYNC_SECRET` as
catalog sync); the app API proxies them under `/admin/website/*` and, for analytics, pulls the
website's orders as the same rows `analytics.service.ts` already computes on (website brand ids
mapped to app ids; website customer ids prefixed `site:`, so a person on both counts twice).
If the website is unreachable, "Both" falls back to app-only with a warning.

### 4.15 One admin for both: the Lickyeat Admin (2026-10-03)
The app admin (`apps/admin`) is THE admin for the app and the website ("Lickyeat Admin").
- **Shared settings synced app → website** (`catalogSync.settings.ts` in both repos, same signed
  link, also sent by "Push everything"): coupons (`coupon.*`), opening hours (`storeHours.upsert` —
  the app's single daily window becomes the website's 7 weekday entries), planned closures
  (`closures.replace`, Lickyeat-wide / per brand / GG Tiffin), and GG Tiffin plans, weekly dishes,
  single-meal prices and add-on prices (`tiffin*`). The website's tiffin menu/prices were constants in
  code; they're now defaults overridden by DB collections (`TiffinCatalog.model.ts`), reloaded on
  boot, every 60 s and right after a sync (`refreshTiffinCatalog`). Website plans carry `syncId` (the
  app plan id); the first sync adopts the matching existing plan (same diet/tier/style/days) and a
  delete only deactivates (subscribers keep their plan). A GG Tiffin closure from the app runs the
  website's own `declareClosure` (closes subscription meals, extends plans, refunds single-meal
  orders) once per new range and never removes one. Website hours/closure checks now use IST.
- **Coupons have channels** (`["app","website"]` default; Coupons page "Works on" checkboxes and
  per-row toggles). The app refuses a website-only code; the website keeps an app-only code switched off.
- **Website work done from the Lickyeat Admin** via admin-peer (`/admin/website/*` proxies):
  Orders page App / Website / Both (website orders: next status, rider assigned at out-for-delivery,
  copy rider link — rider page is on the website origin from `VITE_WEBSITE_ADMIN_URL`), GG Tiffin
  Deliveries App / Website / Both (website single-meal orders from today on + subscribers + today's
  meals in the prep count), **Blog** and **Leads** pages (website-only features). Website errors like
  "Cannot move from received to delivered" pass through as 400.
- **Website side**: header "Admin" opens the Lickyeat Admin (`components/admin/OpenLickyeatAdmin.tsx`
  — bridge with the app token picked up at login, else the admin's `/dashboard`). The website's
  `/admin` is a **backup** for website-only day-to-day work (Dashboard, Orders, GG Tiffin orders,
  Blog, Leads) with a banner to the Lickyeat Admin; its Menu & brands / Feast / Coupons / Store pages
  show a "moved" notice (files kept), and its tiffin page no longer declares closures — anything
  shared changed only on the website would drift from the app.
- Not synced back website → app: settings (one-way by design). Menu/brand/combo/add-on/switch sync is
  still two-way (§4.12).

---

## 5. What's explicitly deferred / not done

- No real geocoding — delivery-zone and distance-from-shop are both self-reported/hardcoded
  placeholders, not real geolocation.
- No real rider/dispatch system — delivery partners are a fixed fake pool, not live people.
- Refunds are recorded, never actually pushed through Razorpay's refund API.
- No Razorpay **webhook** — reconciliation relies entirely on the client calling
  `/razorpay/*-verify` itself right after `RazorpayCheckout.open()` resolves. If that call never
  fires (app killed, network drop, the customer completes payment but the app doesn't get the
  callback), the order/subscription/purchase is stuck at `payment.status: "pending"` with no
  automatic recovery — someone has to notice and follow up manually. Deliberately not built yet:
  each of the four payment surfaces' verify logic (Cart orders, Tiffin plans, Tiffin single-meal,
  Premium Membership) has its own side effects on success (loyalty advancement, membership expiry
  extension, WhatsApp alerts) that aren't guarded to be safely callable twice — wiring a webhook
  to reuse them as-is risks double-firing those the first time both the client's own verify call
  and a webhook retry land for the same payment. Needs an idempotency pass first.
- No real Razorpay Dev Client build exists yet — `react-native-razorpay` is installed and coded
  against (see the Payments bullet above), but nobody has run `expo prebuild` /
  `eas build --profile development` (or a local Android build) to actually produce and install
  one. Until that happens, tapping "Pay with Razorpay" anywhere in the app fails with a caught,
  friendly error under both Expo Go and a plain unmodified build.
- WhatsApp templates are placeholder names pending real Meta Business template approval.
- A handful of tiffin dishes have no dedicated photo (see §4.5) — pending real photos from the
  business.
- No CI on-device UI test automation — Vitest covers logic only; on-device verification is manual
  (see §7.3).
- Hosting/deployment: still nothing actually deployed anywhere publicly. MongoDB Atlas is now
  provisioned and in use (see §7.1) but only as this machine's dev database, not a production
  environment. See §8 for what's been prepared toward deployment and what's still needed.
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
- **Database is a real, persistent MongoDB Atlas cluster** (`mofree`, project owned by
  ambarish.sonbhadra@gmail.com) — `apps/api/.env`'s `MONGODB_URI` points at it. Data now survives
  restarts; there is no more in-memory dev-mongo step to run, and `apps/api/scripts/dev-mongo.ts`
  is dead code kept only for reference (mongodb-memory-server), not part of the current setup.
  - **The connection string is a standard (non-`+srv`) URI, not the `mongodb+srv://...` one Atlas's
    "Connect" dialog shows by default.** Node's own DNS resolver fails to do the SRV lookup on this
    machine (`querySrv ECONNREFUSED`) even though Windows' native resolver handles it fine — a
    known Node-on-Windows quirk, not an Atlas config problem. The working URI instead lists the
    three shard hosts directly (`ac-sepm43r-shard-00-0{0,1,2}.5vlr2yd.mongodb.net:27017`) plus
    `replicaSet=atlas-2d7hh4-shard-0&authSource=admin` — both values were read off the `SRV`/`TXT`
    DNS records for `mofree.5vlr2yd.mongodb.net` via PowerShell's `Resolve-DnsName` (which *does*
    work), not off anything in the Atlas UI. If the cluster is ever rebuilt and this breaks again,
    re-derive it the same way rather than assuming the `+srv` string can just be pasted back in.
  - The database user is `ambarishsonbhadra_db_user` (Atlas project → Security → Database Access).
  - Re-seed a **truly empty** cluster with `pnpm run seed` (in `apps/api`) — but unlike the old
    in-memory setup, this is now a one-time thing, not "after every restart."
- Real menu/tiffin images and their original filenames live at `D:\Menu pics and names` — check
  there first when asked about a missing or wrong image, don't assume `apps/api/public/*-images/`
  is the complete/authoritative set (it's a copy, and copies can lag).

### 7.2 Bringing the whole stack up from cold
```bash
# 1. API (connects straight to Atlas — no local Mongo step anymore)
cd apps/api && pnpm run dev           # background; wait for GET /health to return {"ok":true}
# 2. Metro bundler
cd ../mobile && npx expo start        # background; wait for "Waiting on http://localhost:8081"
# 3. Emulator (can run in parallel with 1-2)
"/d/SDK location/emulator/emulator.exe" -avd Pixel_7
# wait for `adb wait-for-device shell 'while [[ -z $(getprop sys.boot_completed) ]]; do sleep 2; done'`
# 4. Port forwarding (needed again after every emulator restart)
adb reverse tcp:4000 tcp:4000
adb reverse tcp:8081 tcp:8081
# 5. Launch (Expo Go is already installed on the AVD image)
adb shell am force-stop host.exp.exponent   # guarantees a genuine cold reload, not a resumed stale task
adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081"
```
`expo start --android` and other flows that spawn interactive CLI prompts (version-mismatch,
port-in-use) hang forever with no TTY attached — always use plain `expo start` + the `am start`
intent above instead.

If `GET /health` never returns and the API's own log shows a Mongo connection error, the cluster
data may genuinely be empty (a fresh Atlas cluster, or one that was recreated) — after confirming
the API actually connects, run `pnpm run seed`, then recreate the admin login (`POST /auth/signup`
with any email, then `pnpm run promote-admin <that email>` in `apps/api`) since seeding doesn't
create one. Admin panel login in this dev environment: `admin@lickyeat.com` / `Lickyeat@123`.

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

## 8. Deployment prep (Cloud Run) — what's done, what's still needed

Nothing is deployed publicly yet — this section tracks the deployment work that's already landed
in code, so it doesn't get redone or second-guessed later. Full plan history lives at
`C:\Users\ASUS\.claude\plans\fancy-leaping-quilt.md`.

**Hosting decision**: API on **Google Cloud Run** (not Render, not a VM). Serverless containers,
scale-to-zero, 2M requests/month + 180K vCPU-seconds free tier — realistically ~$0/month at this
app's current scale, vs. Render's $7/mo Starter minimum for an always-on service. Trade-off is a
cold start after scale-to-zero, accepted for now. Both Cloud Run and Render have an **ephemeral
filesystem by default** — a raw VM is the only one of the three that doesn't — which is why the
image-upload migration below was necessary regardless of which of the two got picked.

**The separate Lickyeat website project** (`D:\Lickyeat website`) is being deployed alongside this
one (decided 2026-09-30) — same GCP project, its own two Cloud Run services (API + Next.js web
app). See that project's own `AGENT.md` §8 for its deployment prep; not duplicated here.

### 8.0 LIVE since 2026-10-02 (Cloud Run, `asia-south1`, project `project-95f89cd8-dde5-4bea-a3a`)
Full runbook with every command: `D:\Plan for app and website\deployment-plan.html`.

| Service | URL |
|---|---|
| API (`lickyeat-api`) | https://lickyeat-api-1082151978826.asia-south1.run.app |
| Admin (`lickyeat-admin`) | https://lickyeat-admin-1082151978826.asia-south1.run.app |

- **gcloud** is installed on this machine and logged in as the *testing* account
  (`ambarish.sonbhadra@gmail.com`); at go-live, add the user's main email as project Owner instead
  of recreating anything. Use Bash, not PowerShell, when piping secret values into gcloud —
  PowerShell 5.1 appends line-ending bytes to piped input.
- **Only production account**: `support@lickyeat.com` (admin) — on both the app and website DBs,
  same password (the admin-login bridge relies on that). No demo admin, no test users/orders.
- **Database**: `lickyeat_app_prod` on the same Atlas cluster as dev, via user `lickyeat_prod`
  (`readWrite` on the two prod DBs only — verified it is denied on the dev `tbc` DB). Catalog was
  copied from dev with image URLs rewritten to the bucket
  (`D:\Plan for app and website\scripts\copy-app-catalog.cjs`).
- **Images**: bucket `lickyeat-uploads-95f89cd8` (public read). The 109 pre-existing photos were
  uploaded there; new admin uploads go there via `GCS_BUCKET_NAME`.
- **Secrets** (Secret Manager): `app-jwt-secret`, `app-mongodb-uri` — readable only by
  `lickyeat-api-sa`. Builds run as `lickyeat-build-sa` (Cloud Build builder role) because new
  projects no longer give the default compute account build permissions.
- **API** deploys with `gcloud run deploy lickyeat-api --source .` (root `Dockerfile`) plus
  `--build-service-account`, `--service-account`, `--update-secrets`, `--env-vars-file`. Env vars go
  in a YAML file — gcloud runs through cmd.exe here, which eats `^`-escaped values.
- **Admin** builds via `cloudbuild.admin.yaml` with `--ignore-file=.gcloudignore.admin` (skips the
  218 MB of API photos — upload went 264 MB → 47 MB). Its three `VITE_*` URLs are baked in at
  build time; its CSP `connect-src` allows exactly the app API and the website API.
- Production fixes made while deploying: `app.set("trust proxy", 1)` (without it all customers
  shared one rate-limit bucket behind Cloud Run's proxy); non-root `USER node` containers; filtered
  `pnpm install` so the API/admin images don't pull the Expo tree.
- **Not yet done**: rotate the old dev DB user's password (`ambarishsonbhadra_db_user`, sat in
  plaintext in `apps/api/.env`) and update that file; domain + subdomains (then rebuild admin and
  the website web image, update CORS); Razorpay Test keys; mobile `apiBaseUrl` → the API URL above.

### 8.1 Done

- **`GET /health` reflects real DB connectivity**, not just "the process is alive"
  (`apps/api/src/app.ts`): checks `mongoose.connection.readyState === 1`, returns
  `{"ok":true,"db":"connected"}`/200 or `{"ok":false,"db":"disconnected"}`/503. A hosting
  platform's own health check should notice a dropped Mongo connection. Covered by
  `apps/api/__tests__/integration/health.test.ts`.
- **Image uploads no longer depend on local disk.** `apps/api/src/modules/{menu,brands,tiffin}/upload.ts`
  are now thin factories (`createMenuImageUploadHandlers(env)` etc.) over a shared
  `apps/api/src/utils/imageUpload.ts#createImageUploadHandlers(env, folderName)`:
  - `env.GCS_BUCKET_NAME` **unset** (local dev, unchanged): `multer.diskStorage` into
    `apps/api/public/<folder>`, served by the existing `express.static` mounts in `app.ts` — zero
    new setup needed for local dev.
  - `env.GCS_BUCKET_NAME` **set**: `multer.memoryStorage()` + upload the buffer to that Cloud
    Storage bucket, returns a `https://storage.googleapis.com/<bucket>/<folder>/<uuid>.<ext>` URL.
    Uses Application Default Credentials — on Cloud Run this is the service account attached to
    the service, no key file needed. Deliberately never sets an object-level ACL — the target
    bucket is expected to use **uniform bucket-level access** with `allUsers` granted
    `Storage Object Viewer` at the bucket level instead (object ACLs are rejected on a bucket in
    that mode).
  - Added `GCS_BUCKET_NAME: z.string().optional()` to `apps/api/src/config/env.ts` (and
    `.env.example`), following this codebase's existing convention of threading all config through
    the validated `Env` type rather than reading `process.env` ad hoc.
  - Covered by `apps/api/__tests__/unit/imageUpload.test.ts` (GCS path, `@google-cloud/storage`
    mocked) plus the pre-existing `admin.menuItems.test.ts`/`brands.test.ts`/`admin.tiffinMenu.test.ts`
    upload tests (disk-fallback path, behavior unchanged).
- **`Dockerfile`** at the **repo root** (not `apps/api/` — deliberately: `gcloud run deploy
  --source .` only ever looks for a Dockerfile at the root of whatever directory `--source`
  points at, with no flag to point it at a subdirectory's file instead — confirmed against
  gcloud's own reference docs after an earlier version of this file wrongly claimed a
  `--dockerfile` flag existed. Since this is a pnpm workspace and the build needs the whole
  monorepo as context anyway, putting the file at the context root is what makes the zero-flag
  deploy command actually work: `gcloud run deploy lickyeat-api --source . --region <region>`).
  Two stages: `node:20-slim` + `python3`/`make`/`g++` (bcrypt needs to compile its native addon)
  to `pnpm install` and `pnpm exec turbo run build --filter=@tbc/api...` (builds `@tbc/pricing` +
  `@tbc/shared-types` first, via turbo's `^build` dependency graph), then a runtime stage that
  copies the whole built `/repo` (workspace symlinks between `@tbc/api` and its two workspace
  dependencies mean copying just `apps/api` would leave those dangling) and runs
  `node dist/index.js` from `apps/api`. Listens on `env.PORT` — `index.ts` already read this from
  the validated `Env` before Cloud Run was even a consideration, so Cloud Run's injected `PORT`
  (defaults to 8080) needed no code change. **The `pnpm install` + `turbo build` step inside this
  Dockerfile was verified locally (run outside Docker, same commands) and produces `dist/index.js`
  correctly — the Dockerfile itself has NOT been run through an actual `docker build`**, since
  Docker isn't available in this dev environment. Run a real `docker build` (and ideally
  `docker run` against a Test-Mode Razorpay + real Atlas config) before trusting it fully in Cloud
  Run. If a second service in this monorepo ever needs its own Dockerfile, this single-root-file
  setup stops being unambiguous — revisit then.
- **`apps/mobile/eas.json`** created (`development`/`preview`/`production` build profiles) — EAS
  builds are unblocked now, this file didn't exist before.
- Confirmed (not assumed — corrects an earlier planning mistake) that `apps/mobile/app.json`
  already has real `ios.bundleIdentifier`/`android.package` (`com.lickyeat.app`) — nothing to set
  there.
- **Admin dashboard is now deployable standalone** (Phase 2). It was built assuming a relative
  `/api` path, reverse-proxied under the same origin as the API — fine for local dev (`vite.config.ts`'s
  dev-server proxy rewrites `/api` → `http://localhost:4000`) but broken if deployed on its own
  origin with no proxy in front of it.
  - `apps/admin/src/api/adminClient.ts` now reads `import.meta.env.VITE_API_BASE_URL`, falling
    back to `/api` (local dev unchanged) — mirrors the pattern already used in mobile's
    `apiClient.ts` (`Constants.expoConfig?.extra?.apiBaseUrl`). New `apps/admin/src/vite-env.d.ts`
    declares the env var for TypeScript (Vite's default `ImportMetaEnv` has no index signature).
  - **Found and fixed a real bug this change would otherwise have caused**:
    `apps/admin/server/securityHeaders.ts`'s production CSP had `connect-src 'self'` only — once
    `VITE_API_BASE_URL` points at a different origin, the browser's CSP (not CORS) would have
    silently blocked every API call, a confusing failure mode with no CORS error to point at.
    `securityHeaders(nodeEnv, apiOrigin?)` now takes the API's origin and adds it to
    `connect-src` in production. `apps/admin/server/server.ts` derives `apiOrigin` from the same
    `VITE_API_BASE_URL` env var (parses it with `new URL(...).origin` when it looks absolute) —
    deliberately the same variable name Vite reads at build time, so only one env var needs to be
    set correctly, not two kept in sync by hand.
  - New `apps/admin/.env.example` documents `VITE_API_BASE_URL` needing to be set at **both**
    build time (Vite inlines it) and runtime (the Express server in `server/server.ts` reads it
    for the CSP) — in practice, set once in whichever environment does both the build and the
    serve.
  - Verified with a real `vite build` both ways: unset → bundle contains literal `/api` (unchanged
    default); `VITE_API_BASE_URL=https://api.lickyeat.com` → bundle contains that literal URL
    inlined. Typecheck and the full admin test suite (5 tests) both pass unchanged.
  - **Still not done**: actually deploying it anywhere, and once the real API domain is chosen,
    the API's own `CORS_ORIGINS` needs the admin's real deployed origin added (currently only
    localhost values).

### 8.2 Still needed before Cloud Run deployment is actually live

- A GCP project + a Cloud Storage bucket: **uniform bucket-level access** on, `allUsers` granted
  `Storage Object Viewer` (public read for images), and the Cloud Run service's attached service
  account granted `Storage Object Admin`/`Creator` on that bucket (so it can write uploads).
- Cloud Run env vars (set in the console/`gcloud`, never committed): `MONGODB_URI` (rotated —
  the one in `apps/api/.env` has been sitting in plaintext and should be rotated in Atlas once
  moved), `JWT_SECRET` (a **fresh** `openssl rand -hex 32` value — don't reuse the local dev one;
  `apps/api/.env`'s dev placeholder was replaced with a real random value on 2026-09-18, but dev
  and prod secrets should never be the same value), `NODE_ENV=production`, `CORS_ORIGINS` (real
  mobile/admin origins, not localhost), `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` (Test Mode keys to
  start — need zero KYC), `GCS_BUCKET_NAME`, `WHATSAPP_*` (fine to leave empty, already fails
  silently by design).
- An actual `docker build`/`docker run` smoke test of the root `Dockerfile` (not yet run — see
  above).
- A production MongoDB Atlas cluster **separate** from the one this dev machine uses (§7.1), so
  real test data doesn't mix with throwaway dev data. Atlas Network Access: allow `0.0.0.0/0`
  (Cloud Run has no static outbound IP) and rely on the rotated password as the real safeguard.
- Custom domain (e.g. `api.lickyeat.com`) mapped to the Cloud Run service, once a domain is chosen.
- `apps/mobile/app.json`'s `expo.extra.apiBaseUrl` still points at `localhost:4000` — update once
  a real Cloud Run URL/domain exists.
- Admin dashboard: the code-side blocker (relative `/api` path assuming a reverse proxy) is fixed
  — see §8.1 above. Still needed: actually pick a host and deploy it (a static-file host or the
  same `apps/admin/server/server.ts` Express server behind any Node host both work — no Dockerfile
  exists for admin yet, unlike the API), set `VITE_API_BASE_URL` to the real deployed API URL for
  that build, a custom subdomain (e.g. `admin.lickyeat.com`), and add that origin to the API's
  `CORS_ORIGINS`.
- Apple Developer Program ($99/yr) / Google Play Console ($25 one-time) enrollment — external,
  user's own action, needed before EAS `preview` builds can be installed via TestFlight (Android
  sideloading doesn't need either).

---

## 9. Keeping this file useful
When you finish a meaningful chunk of work: add or update the relevant section above rather than
letting this file drift. Prefer editing an existing section over appending a new "recent changes"
list at the bottom — this file describes *current state*, not a changelog (git history is the
changelog).
