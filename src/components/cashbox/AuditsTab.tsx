import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCashbox } from "./context";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Calculator } from "lucide-react";

export function AuditsTab() {
  const {
    cur,
    accounts,
    audits,
    setIsAuditModalOpen,
  } = useCashbox();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold">محاضر جرد الفئات النقدية وتسوية الدرج</h3>
          <p className="text-xs text-muted-foreground">
            توثيق عد النقدية الفعلي بالفئات ومطابقته مع رصيد النظام واكتشاف الفروقات
          </p>
        </div>
        <Button
          onClick={() => setIsAuditModalOpen(true)}
          className="rounded-full px-5 text-xs font-bold gap-1.5 h-9"
        >
          <Calculator className="h-4 w-4" />
          بدء جرد نقدي جديد
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {audits.map((aud) => {
          const acc = accounts.find((a) => a.id === aud.accountId);
          const isExact = aud.variance === 0;
          const isSurplus = aud.variance > 0;

          return (
            <div key={aud.id} className="rounded-2xl border border-foreground/10 bg-card p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm">{aud.auditNumber}</span>
                  <span className="text-[10px] text-muted-foreground block">
                    {new Date(aud.countedAt).toLocaleString("ar-EG")}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-bold",
                    isExact
                      ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                      : "border-amber-500/30 text-amber-600 bg-amber-500/10"
                  )}
                >
                  {isExact ? "مطابق تماماً" : isSurplus ? `زيادة (+${fmt(aud.variance)})` : `عجز (${fmt(aud.variance)})`}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-[var(--hairline)]">
                <div>
                  <span className="text-[10px] text-muted-foreground block">الخزينة المجرودة</span>
                  <span className="font-bold">{acc?.name || "الدرج"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">المسؤول عن الجرد</span>
                  <span className="font-semibold">{aud.countedBy}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">المبلغ الفعلي المحصى</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {fmt(aud.totalActualCash)} {cur}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">رصيد النظام المسجل</span>
                  <span className="font-bold tabular-nums">
                    {fmt(aud.systemExpectedCash)} {cur}
                  </span>
                </div>
              </div>

              {/* Denomination Breakdown pills */}
              <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                {aud.denominations.d200 > 0 && <span className="bg-muted px-1.5 py-0.5 rounded">200ج × {aud.denominations.d200}</span>}
                {aud.denominations.d100 > 0 && <span className="bg-muted px-1.5 py-0.5 rounded">100ج × {aud.denominations.d100}</span>}
                {aud.denominations.d50 > 0 && <span className="bg-muted px-1.5 py-0.5 rounded">50ج × {aud.denominations.d50}</span>}
                {aud.denominations.d20 > 0 && <span className="bg-muted px-1.5 py-0.5 rounded">20ج × {aud.denominations.d20}</span>}
                {aud.denominations.d10 > 0 && <span className="bg-muted px-1.5 py-0.5 rounded">10ج × {aud.denominations.d10}</span>}
                {aud.denominations.d5 > 0 && <span className="bg-muted px-1.5 py-0.5 rounded">5ج × {aud.denominations.d5}</span>}
                {aud.denominations.coins > 0 && <span className="bg-muted px-1.5 py-0.5 rounded">فكة: {aud.denominations.coins}ج</span>}
              </div>

              {aud.varianceReason && (
                <div className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded-lg">
                  <span className="font-bold text-foreground">سبب الفارق: </span>
                  {aud.varianceReason}
                </div>
              )}
            </div>
          );
        })}

        {audits.length === 0 && (
          <div className="col-span-full py-16 text-center text-muted-foreground rounded-2xl border border-dashed border-foreground/10 bg-card/40">
            <Calculator className="h-10 w-10 mx-auto opacity-30 mb-2" />
            لا توجد محاضر جرد مسجلة حتى الآن. استخدم حاسبة الفئات لبدء أول جرد.
          </div>
        )}
      </div>
    </div>
  );
}
