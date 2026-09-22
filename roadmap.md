# Roadmap

## Expenses — missing items (done)
- [x] Treasury balance check before disbursing + live available balance in the form
- [x] Sequential official voucher numbers (VCH-YYYY-000001) with a registry linked to expenses
- [x] Real auto-generation of recurring expenses (autoApprove toggle + daily runner + alerts)
- [x] Thermal 80mm / A4 voucher printing per shop print settings
- [x] Clean voucher statement (hidden metadata stripped) + barcode
- [x] Category icon picker + real color application (cards + expense rows)
- [x] Cost centers on expenses, budgets scoped by branch / cost center, per-dimension reports

## Invoices (earlier)
- [x] Per-line discount/tax/serial, public receipt links, receipt image export

## Dashboard accuracy and actions (done — verified against code)
- [x] Show verified treasury state and explicit load failure — `dashboard/context.tsx` treasuryLiquidityResult, `غير متاح` fallback, export blocked when unverified
- [x] Replace estimated profit and debt trends with accounting calculations — netProfit/debtTrend/profitTrend from actual costs, no estimates
- [x] Use actual inventory sale valuation in executive export — computed in context + rendered as "تقييم المخزون (بسعر البيع)" KPI in `executive-report-pdf.ts`
- [x] Unify due-today definitions — shared `isDueDay()` in `financial-utils.ts`, used by dashboard + customers; alerts buckets documented as lateness-based by design
- [x] Time-filter and rank top products by quantity or revenue — global timeRange + quantity/revenue toggle
- [x] Correct unsettled COD semantics — split into collected-in-hand vs still-with-customer (`shippingStats.collected*/uncollected*`)
- [x] Open quick-operation forms directly — deep links + Fab dialogs
- [x] Surface range collections as a KPI — rangeCollected card + buckets + export
- [x] Preserve custom section order when new sections are introduced — `useDashboardLayout` merge keeps order/visibility, appends new

## Shipped but untracked (done, added for accuracy)
- [x] Privacy masking of numbers across dashboard sections
- [x] Reconciliation health KPI + header badge
- [x] Global today/7d/month/all time filter
- [x] Dashboard customization modal (toggle + reorder + reset)
- [x] Executive PDF export with audit summary
- [x] Smart insights engine + 6-month forecast and status charts
