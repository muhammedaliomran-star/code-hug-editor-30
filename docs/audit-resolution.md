# سجل تنفيذ الفحص (Resolution Log)

**تاريخ التنفيذ:** 2026-11-05

## تم إصلاحه (P0)
- **C1 (piasters):** Option A — restored `/100` (read) and `*100` (write) in `src/lib/db.ts` (9 sites). Restored migration file `20261109000000_phase5c_piasters_shipping.sql`.
- **C2 (courier-token):** added `/100` to baseCost/shippingCost/codAmount.
- **C3 (public-receipt):** divided all monetary fields by 100.
- **H5 (Returns items):** added stable `id`; removal by id; key={it.id}. Discounts keyword key composite.

## تصحيح (False Positive)
- **H1:** مسارات branches/cashbox/payments/pos محمية عبر `appRoute()` (beforeLoad: requireAuth). لا تغيير.

## مؤجل (يحتاج DB/CLI/قرار منتج)
- **H2 (cashier role server-side):** requires DB migration + RPC.
- **M5 (apply pending SQL):** apply manually in Supabase Dashboard.
- **M1 (regenerate types):** requires `supabase` CLI.
- **M2 (console.* gating):** deferred (polish).
- **H4 (loading states):** deferred (UI audit).
- **M3 (cross-domain money audit):** partially addressed by C1.

## التحقق
- لم أتمكن من تشغيل `tsc/eslint/vitest/build` (Bun/Node hang في البيئة). **شغّل في CI/محلياً.**
- Manual smoke test (shipping E2E) مطلوب.