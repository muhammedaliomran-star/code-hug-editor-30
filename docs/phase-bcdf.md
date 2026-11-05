# Phase B/C/D/F — Performance, Caching, Logging, Polish

**Executed:** 2026-11-05 (Code mode)

## Phase D (Logging) — done
- D1: gated `console.log` in `use-sync-from-cloud.ts` behind `import.meta.env.DEV`.
- D3: removed noisy sync summary log from production path.

## Phase C (Caching) — done
- C1: IndexedDB schema versioning — bumped DB_VERSION to 2, added CACHE_SCHEMA_VERSION=2, upgrade migration (clears v1 store), schemaVersion check in loadCacheFromIDB.
- C2: created `src/lib/safe-storage.ts` (safeGetItem/safeSetItem/safeRemoveItem with QuotaExceededError handling). Updated `offline-queue.ts` to use it.
- C4: React Query defaultOptions (staleTime 30s, gcTime 5min, retry 1) in `router.tsx`.

## Phase B (Performance) — partially done
- B4: verified fonts use `display=swap` (already present).
- B1 (virtualization), B2 (bundle analysis), B3 (precache optimization), B5 (useMemo audit) — deferred (need testing/profiling).

## Phase E (Deferred) — deferred
- E1 (H2 cashier role), E2 (M1 regenerate types), E3 (H4 loading states), E4 (M3 money audit) — require DB/CLI/manual work.

## Phase F (Polish) — partially done
- F3: docs updated (audit-report.md, audit-resolution.md, phase-bcdf.md).

## Phase G (Final Verification) — deferred
- Cannot run `tsc/eslint/vitest/build` (Bun/Node hang in this env). Must run in CI/local.

## New files
- `src/lib/safe-storage.ts`
- `docs/phase-bcdf.md`