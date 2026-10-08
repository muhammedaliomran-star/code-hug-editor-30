# UI Contract — Segilly pages

Single source of truth for operational pages (dashboard, cashbox, daily,
customers, invoices, shipping, inventory, expenses, reports, reconciliation,
suppliers, payments, branches, staff, discounts, returns, purchases,
warehouse, alerts, audit, settings, admin, owner companion).

Excluded by design (different nature): Landing, Auth/ResetPassword,
POS + kiosks (CourierPortal, DeliveryPortal, PosDisplay), PublicReceipt,
print/PDF documents.

## Canonical page anatomy (in this order)

1. `PageHeader` — title + subtitle + actions only.
2. Header actions — `ActionButton` only (`primary` = main action, `surface` = rest).
3. KPI row — `MetricCard` only. Sizes: `hero` (1 featured max), standard,
   `mini` (dense grids). Tones: `positive` / `neutral` / `danger` only.
4. Filters — `FilterChips` (multi-option) or `StatTabs` (status strip). One bar per page.
5. Content sections — `BezelCard`, spacing `space-y` / `mb-14` between blocks.
6. States — `PageLoadingSkeleton` while loading, `EmptyState` when empty.
   Never a bare spinner or bare text.

## Forbidden (auto-reject in review)

- Hand-rolled stat/KPI cards (any `div` showing a big number outside `MetricCard`).
- Hand-rolled filter/tab bars (chips, pills, segmented strips).
- Raw `Button` in a page header action slot.
- New color tokens outside `text-success / text-danger / text-foreground`
  (+ amber `text-amber-600` only for warnings) and outside BezelCard surfaces.
- Touch targets under 40px on interactive rows/buttons in mobile views.

## Rules that keep this contract alive

- Fix the shared component, never fork a local copy.
- If no shared component fits, add the variant to the kit (with a story
  in the contract), don't inline it in the page.
- Delete the hand-rolled version in the same commit that migrates a page.
- KPI rows: one optional `hero` band (`col-span-full`, Dashboard/Customers
  only); every other row is a single size (`standard` ≤ 6 cards,
  `mini` ≥ 7); canonical grid `grid-cols-2 lg:grid-cols-4 gap-4`
  (3 cols for 3/6/9 cards); equal heights via `h-full` + `auto-rows-fr`.
- Type floors: metadata 12px (`11px` semibold for mini/badges); no
  letter-spacing on Arabic script; page titles wrap, never truncate.
- Touch targets ≥ 40px on all interactive rows/buttons (mobile included).
- Never use sparkle symbols (emoji or unicode) in UI strings or templates.
  The `Sparkles` lucide glyph is allowed only as the "AI-generated" marker.

## Accepted deviations (documented, do not re-open)

- Semantic colors (`success / danger / warning / primary`, brand amber):
  kept by owner decision. Automated design-audit extensions flag saturated
  color on principle; those flags are advisory, not defects.
- POS cart structure (panel > rows > totals hero): intentional hierarchy on
  a dense operational surface (POS is in scope since the cashier pass).
- `transition: height` audit flag: no source exists in code (verified by
  exhaustive text search — zero height animations; Reveal/PageTransition
  are transform/opacity only). Treat as a detector false positive unless it
  names a specific element.
- Brand teal/amber accents, skeleton shimmer, scanner pulse: pinned identity
  and legitimate loading/scanning patterns.
- Print/PDF output keeps its own physical sizes (excluded domain).

## Normative rule

Repo gates (`typecheck`, `lint`, tests, and the pattern scans in this file)
are normative. Third-party audit overlays are advisory: a flag without a
code source is documented here and closed, never re-opened.
