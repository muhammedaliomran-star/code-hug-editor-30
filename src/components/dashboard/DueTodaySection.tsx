import { Link } from "@/lib/router-compat";
import { CalendarCheck, Phone, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { SectionHead } from "./shared";
import { MetricLabel } from "@/components/MetricCard";
import { useDashboard } from "./context";

export function DueTodaySection() {
  const { dueToday, totalDueToday, privacy, money } = useDashboard();

  return (
    <section className="mb-14">
      <Reveal className="h-full" delay={0}>
        <BezelCard variant="flat" className="h-full" innerClassName="flex h-full flex-col p-6 sm:p-8">
          <SectionHead
            title="أقساط تستحق التحصيل اليوم"
            icon={<CalendarCheck className="h-5 w-5 text-warning" />}
            aside={
              <div className="text-left">
                <MetricLabel>الإجمالي المستحق</MetricLabel>
                <div
                  className={cn(
                    "text-numeric mt-1.5 text-lg font-extrabold text-warning",
                    privacy && "privacy-blur",
                  )}
                >
                  {money(totalDueToday)}
                </div>
              </div>
            }
          />
          {dueToday.length === 0 ? (
            <div className="grid flex-1 place-items-center py-14 text-center">
              <div>
                <p className="text-sm font-bold text-foreground/80">لا توجد أقساط مستحقة اليوم</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  يمكنك مراجعة جدول التنبيهات لمعرفة المواعيد القادمة.
                </p>
                <Link
                  to="/alerts"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3.5 py-1.5 text-xs font-bold text-foreground ring-1 ring-border transition-[background-color,transform] hover:bg-foreground/[0.10] active:scale-[0.98]"
                >
                  افتح جدول التنبيهات <ArrowLeft className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {dueToday.map((row) => (
                <div
                  key={row.inv.id}
                  className={cn(
                    "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-2xl p-3.5 ring-1 transition-colors",
                    row.late > 0
                      ? "bg-danger/[0.06] ring-danger/20 hover:bg-danger/[0.11]"
                      : "bg-warning/[0.06] ring-warning/20 hover:bg-warning/[0.11]",
                  )}
                >
                  <div className="flex shrink-0 items-center gap-3">
                    {row.customer?.phone && (
                      <a
                        href={`tel:${row.customer.phone}`}
                        className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/25 transition hover:bg-primary/20 active:scale-[0.95]"
                        title="اتصال"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                    <div className="text-left">
                      <div
                        className={cn(
                          "text-numeric text-base font-extrabold leading-none",
                          row.late > 0 ? "text-danger" : "text-warning",
                          privacy && "privacy-blur",
                        )}
                      >
                        {money(row.due)}
                      </div>
                      <div className="mt-1.5 text-[11px] text-muted-foreground">
                        مستحق اليوم
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 text-right">
                    <div className="truncate text-sm font-bold">{row.customer?.name ?? "—"}</div>
                    <div className="truncate text-[11px] text-muted-foreground" dir="ltr">
                      {row.customer?.phone ?? ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </BezelCard>
      </Reveal>
    </section>
  );
}