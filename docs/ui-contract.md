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
