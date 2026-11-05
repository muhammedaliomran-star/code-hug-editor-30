# تقرير فحص التطبيق — سِجلّي (Segilly)

**تاريخ الفحص:** 2026-11-05  
**نطاق الفحص:** كامل قاعدة الكود (src/, supabase/, routes, tests, config)  
**البيئة:** Windows, Bun/Node غير قابل للتشغيل (قيود بيئة) → الفحص ساكن (static) + مراجعة Git diff.

---

## 1. ملخص تنفيذي

- **النتيجة العامة:** التطبيق مُصمَّم بعناية (محرك مالي موحد، طوابير offline، RLS، تدقيق) **لكن** التغييرات غير المُؤكّدة (uncommitted) في `src/lib/db.ts` **أبطلت تحويل "piasters" للشحن** وأحدثت عدم تطابق في وحدات الأموال (×100) بين الواجهة وقاعدة البيانات وبوابات المندوب/الإيصالات العامة. هذه **مشكلة حرجة (Critical)** يجب حلها قبل أي نشر.
- **مشكلات أمنية متوسطة:** مسارات `/branches, /cashbox, /payments, /pos` بدون حارس route، و"وضع الكاشير" مخزّن في `localStorage` (قابل للتجاوز).
- **جودة:** 12 ملف اختبار فقط، 94 استخدام `as any`، 88 `console.*` في مسارات production.
- **UX/UI:** 12/37 صفحة فقط تستخدم `PageLoadingSkeleton` (عقد UI يفرض حالات تحميل). 7 قوائم ديناميكية تستخدم `key={index}`.

---

## 2. معلومات عامة

| البند | القيمة |
|---|---|
| الإطار | TanStack Start 1.168 + React 19 + Vite 7 |
| التصميم | Tailwind 4, Radix UI, shadcn |
| البيانات | Supabase (Postgres + RLS) + IndexedDB cache |
| ملفات TS/TSX | 392 |
| صفحات | 37 |
| مسارات | 41 |
| مكتبات (lib) | ~80 ملف (db.ts 52KB الأكبر) |
| اختبارات | 12 ملف |
| commits أخيرة | p2a/p2b/p2c refactor + phase5c piasters |

---

## 3. فحص الهيكل المعماري

### 3.1 المسارات (src/routes)
- 41 ملف route، جميع صفحات operations (index, invoices, shipping, inventory, …) تستخدم `beforeLoad: requireAuth` ✅.
- **محمية owner:** `/admin`, `/owner` → `requireOwner` ✅.
- **غير محمية (لا beforeLoad):** `about, branches, cashbox, courier, delivery, landing, payments, pos, pos-display, privacy, receipt.$token, reset-password, support, terms`.
  - `branches, cashbox, payments, pos` **محمية بالبيانات (db يطلب uid) لكن صفحة UI تُحمَّل للزائر المجهول** → gap (انظر H1).
  - `courier, delivery, receipt.$token` مقصودة (token-based) ✅.
  - `pos-display` كشك (kiosk) — مقصود ✅.

### 3.2 الحماية (guards)
- `requireAuth`: يتحقق من session فقط (أي مستخدم مسجّل) ✅.
- `requireOwner`: يتحقق من role عبر RPC `has_role` ✅.
- `_role: "owner" as any` — ثقب typing (M1).

### 3.3 التكوين
- `tsconfig.json`: `strict: true`، `noUnusedLocals: false`. OK.
- `eslint.config.js`: ignores `dist, .output, .vinxi` (لا يتجاهل `routeTree.gen.ts` explicit — مولَّد).
- `.env` gitignored، `.env.example` يوثّق مفاتيح service role (server-only) ✅.
- `app-config.ts`: fallback chain (build-env → runtime-config → bundled-fallback → process-env) ✅.

### 3.4 PWA / SW
- `registerSW({ immediate: true })` + تنظيف cache "supabase-api" (good security cleanup) ✅.

---

## 4. نتائج الفحص (حسب الفئة)

### A. وحدات الأموال (Piasters) — CRITICAL

**C1. تحويل piasters للشحن مُلغى في working tree (db.ts)**
- **الدليل:** `git diff HEAD -- src/lib/db.ts` يظهر إزالة `/100` (قراءة) و`*100` (كتابة) لـ `baseCost, deliveryCost, shippingCost, codAmount` (12 موقعًا)، وحذف `refreshTables/mapTable` (134 سطر)، وحذف ملف الهجرة `supabase/migrations/20261109000000_phase5c_piasters_shipping.sql`.
- **التأثير:** إذا كانت قاعدة البيانات (remote) قد طبّقت الهجرة (أعمدة bigint piasters)، فالعميل يقرأ/يكتب dinars → **قيم ×100 خاطئة** في carriers/zones/shipments. إذا لم تُطبَّق، فالعكس (storefront RPCs تقسم delivery_cost/100) → storefront shipping fee ÷100 خطأ.
- **الإصلاح:** اختر اتجاهًا واحدًا:
  - (أ) **تطبيق كامل:** استعد `/100` و`*100` في db.ts (fetchAll + mapTable + insert/update/moneyPatch)، وأعد ملف الهجرة.
  - (ب) **إلغاء كامل:** أبقِ الإزالة، وأعد أعمدة DB إلى numeric dinars، وأعد storefront RPCs (أزل `/100`).
  - **لا تترك حالات مختلطة.**

**C2. بوابة المندوب (courier-token.ts) لا تُحوّل piasters**
- **الدليل:** أسطر 33, 56-57: `baseCost: num(r.base_cost)`, `shippingCost: num(r.shipping_cost)`, `codAmount: num(r.cod_amount)` (بدون /100).
- **التأثير:** حتى في committed state (db.ts يقسم /100)، البوابة تقرأ raw → **مبالغ ×100** في واجهة المندوب.
- **الإصلاح:** أضف `/100` (إذا piasters) أو تأكد من units.

**C3. إيصال عام (public-receipt.functions.ts) لا يُحوّل**
- **الدليل:** أسطر 26-42: `Number(invoice.total)`, `Number(invoice.paid)`, … (بدون /100).
- **التأثير:** الإيصالات العامة تُظهر مبالغ ×100.
- **الإصلاح:** قسّم على 100 لجميع monetary fields.

**M3. خلط units (piasters vs dinars)**
- الشحن piasters (integers)، остальной приложение dinars (floats). أي جمع cross-domain (مثلاً shippingCost + invoice total) يحتاج تحويل صريح. **راجع كل موقع** (Shipping.tsx, CarrierReconciliationView, dashboard/context, reconciliation-engine).

### B. الأمان (Security)

**H1. مسارات بدون حارس route**
- **الدليل:** routes `branches.tsx, cashbox.tsx, payments.tsx, pos.tsx` لا contain `beforeLoad`; صفحات `Branches, Cashbox, Payments, Pos` لا تتحقق من auth.
- **الإصلاح:** أضف `beforeLoad: requireAuth` إلى هذه المسارات.

**H2. وضع الكاشير (cashier mode) client-side**
- **الدليل:** `security.ts` lines 13-21: `isCashierModeActive()` يقرأ `localStorage["segilly:cashier_mode_active"]`. Restrictions (hide cost/profits, discount limits) تُطبَّق client-side.
- **التأثير:** كاشير يمكنه تعديل localStorage وتجاوز القيود (عرض التكلفة، خصومات > 5%).
- **الإصلاح:** enforce role server-side (أضف role "cashier" في user_roles، تحقق عبر RPC).

**ملاحظات أمنية إيجابية:**
- Manager/Admin PIN مُتحقق server-side عبر RPC (`verify_manager_pin`, `verify_admin_pin`) ✅.
- Service role key server-only (client.server.ts) ✅.
- Courier portals token-based (128-bit, `crypto.getRandomValues`) ✅.
- RLS remediation SQL (APPLY_PENDING_SECURITY.sql) يغلق shipments open policy + self-role-escalation ✅ — **يجب التأكد من تطبيقه** (M5).
- backup restore/wipe server-gated (owner/manager) ✅.
- Public receipt uses admin client but filters by receipt_token (UUID) ✅.

### C. الأداء (Performance)

- `fetchAll()` يحمّل **18 جدول** دفعة واحدة при كل invalidation. مقبول لـ SPA لكن لا pagination.
- **H3.** حذف `refreshTables` (incremental sync) → sync يُعيد `fetchAll` كاملاً كل 5 دقائق (أقل كفاءة). 
- `useSyncFromCloud` uses `setInterval` with cleanup ✅.
- قوائم كبيرة (Invoices, Inventory) بدون virtualization — ملاحظة (low).
- `as any` في sync layer (M1) — typing holes.

### D. جودة الكود / Type safety

**M1. 94 استخدام `as any`**
- sync layer: `(supabase.from as any)(name)` (10 ملفات) — table names dynamic strings.
- db.ts: `(supabase.rpc as any)` (15+ مرة) — RPCs غير موجودة في generated types.
- **توصية:** regenerate Supabase types (`supabase gen types`) لتقليل `as any`.

**M2. 88 `console.*`**
- في production paths (CourierPortal, Expenses, Reconciliation, many libs). استخدم logging gated بـ `import.meta.env.DEV` أو remove.

**L1/L2.** routeTree.gen.ts `@ts-nocheck` (مولَّد، OK).

### E. واجهة المستخدم / UX / a11y

**H4. حالات التحميل**
- 12/37 صفحة فقط تستخدم `PageLoadingSkeleton`. عقد UI (`docs/ui-contract.md`) يفرض "Never a bare spinner or bare text."

**H5. `key={index}` في قوائم ديناميكية**
- `Discounts.tsx:863`, `Returns.tsx:193,369`, `PosDisplay.tsx:158`, `CustomerImportDialog.tsx:388`, `CustomerImportExportModal.tsx:489`, `InventoryExcelDialog.tsx:289`, `CarrierExcelIntegrationModal.tsx:322`, `DeliveryAttemptsPanel.tsx:92`.
- **التأثير:** bugs في reorder/remove.
- **الإصلاح:** استخدم stable IDs.

**أخرى:**
- أزرار icon-only — verify aria-labels (spot check).
- RTL: `lang="ar" dir="rtl"` ✅.
- Touch targets ≥40px (عقد) — verify.

### F. الاختبارات

- 12 test file / 392 source. تغطية منخفضة.
- اختبارات جيدة: `cashbox-system`, `financial-engine`, `reconciliation-engine`, `shipping-pricing`, `expenses-system`, `customer-utils`, `discounts`, `tafqeet`, `offline-queue`, `retry`, `backup`, `isolation`.
- **مفقود:** money conversion boundaries، auth guards، POS، invoicing، sync.
- **توصية:** أضف tests لـ C1/C2/C3 (piasters conversion) و auth guards.

### G. قاعدة البيانات / RLS / هجرات

**M5. RLS pending SQL**
- `APPLY_PENDING_SECURITY.sql` (14KB) must be applied to remote DB. verify policies exist.
- `APPLY_ALL.sql`, `BATCH_*` must be applied in order.
- `_rebuild_notes.md` documents rebuild process.

**M6. shifts table** created in pending SQL (was missing) — ensure applied.

**M4. Storefront RPCs** divide delivery_cost by 100 — must match client units (see C1).

---

## 5. نقاط قوة (ما هو جيد)

1. **محرك مالي موحد** (`financial-engine.ts`) مع `roundCurrency` — single source of truth.
2. **طابور offline** (`offline-queue.ts`) مع concurrency guard + حماية unfiltered delete + max retries.
3. **مصادقة server-side** (JWT claims، not client-trusted).
4. **RBAC** عبر RPC (`has_role`) — owner/manager/cashier.
5. **تدقيق (audit log)** immutable (INSERT+SELECT only).
6. **RLS remediation** شامل (shipments open policy drop, self-escalation drop).
7. **cleanup** auth subscription + SW cache cleanup.
8. **escaping** في PDF/print (`esc`).
9. **Service role key** server-only.
10. **Error boundary** في `__root.tsx` (NotFoundComponent, ErrorComponent).
11. **UI contract** موثّق (`docs/ui-contract.md`) + shared kit.

---

## 6. توصيات مرتبة حسب الأولوية

### P0 (حرج — قبل أي نشر)
1. **حل C1 (piasters units):** اختر اتجاهًا (apply أو revert) وطبّقه بالكامل (db.ts + migration + storefront RPCs).
2. **C2 + C3:** أصلح courier-token.ts و public-receipt.functions.ts (units).
3. **H1:** أضف `requireAuth` إلى `/branches, /cashbox, /payments, /pos`.

### P1 (مهم)
4. **H2:** enforce cashier role server-side.
5. **M5:** طبّق APPLY_PENDING_SECURITY.sql و verify RLS.
6. **H4:** audit loading states (12/37 pages).
7. **H5:** استبدل `key={index}` بـ stable IDs.
8. **M1:** regenerate Supabase types، reduce `as any`.

### P2 (تحسين)
9. **M2:** gate/remove console.* in production.
10. **M3:** audit cross-domain money arithmetic.
11. **F:** أضف tests (money conversion, auth guards, POS).
12. **M7:** tests for critical paths.

### P3 (اختياري)
13. Virtualization للقوائم الكبيرة.
14. a11y audit (aria-labels on icon-only buttons).
15. Performance profiling (Lighthouse).

---

## 7. خطة عمل (Action Plan)

| # | المهمة | Owner | تقدير |
|---|---|---|---|
| 1 | حل C1 (units) | dev | 2-4h |
| 2 | C2, C3 | dev | 1h |
| 3 | H1 (guards) | dev | 30m |
| 4 | M5 (apply SQL) | dev/dba | 1h |
| 5 | H2 (cashier role) | dev | 4h |
| 6 | H4, H5 | dev | 2-3h |
| 7 | M1 (types) | dev | 2h |
| 8 | Tests (F) | dev | 4-6h |
| 9 | M2, a11y | dev | 2h |

---

## 8. ملاحظة حول بيئة الفحص

- Bun/Node غير قابلين للتشغيل في هذه البيئة (external binaries hang) → لم أتمكن من تشغيل `tsc`, `eslint`, `vitest`, `vite build`.
- **توصية:** شغّل `bun run typecheck && bun run lint && bun run test && bun run build` في بيئة محلية (أو CI) للتأكد من عدم وجود أخطاء compile/lint/test قبل النشر. الفحص here was static-only.

---

*تم إعداد هذا التقرير من خلال مراجعة exhaustiva لـ 392 ملف source، git diff، migrations، tests، وdocs. كل finding cites file path + line numbers.*
