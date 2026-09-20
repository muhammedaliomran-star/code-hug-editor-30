import { Link } from "@/lib/router-compat";
import { AlertTriangle, Phone, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { SectionHead } from "./shared";
import { useDashboard } from "./context";

export function AtRiskSection() {
  const { atRiskCustomers, privacy, money } = useDashboard();

  return (
    <Reveal className="mb-14 block">
      <BezelCard variant="flat" innerClassName="p-6 sm:p-8">
        <SectionHead
          title="عملاء بحاجة لمتابعة وتحصيل عاجل"
          icon={<AlertTriangle className="h-5 w-5 text-danger" />}
          aside={
            <Link
              to="/customers"
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.05] px-3.5 py-1.5 text-[11px] font-bold text-muted-foreground ring-1 ring-border transition hover:text-foreground active:scale-[0.98]"
            >
              عرض الكل <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
          }
        />
        {atRiskCustomers.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm font-bold text-foreground/80">لا يوجد عملاء متأخرين حالياً</p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              جميع الأقساط والأرصدة تسير في مواعيد استحقاقها المحددة.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    العميل
                  </th>
                  <th className="hidden py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:table-cell">
                    الهاتف
                  </th>
                  <th className="py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    أيام التأخير
                  </th>
                  <th className="py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    الرصيد المستحق
                  </th>
                  <th className="py-2.5" />
                </tr>
              </thead>
              <tbody>
                {atRiskCustomers.map((row) => (
                  <tr
                    key={row.customer.id}
                    className="border-b border-border/40 transition-colors last:border-0 hover:bg-danger/[0.06]"
                  >
                    <td className="py-3 font-bold">{row.customer.name}</td>
                    <td className="hidden py-3 text-muted-foreground sm:table-cell" dir="ltr">
                      {row.customer.phone || "—"}
                    </td>
                    <td className="py-3">
                      <span className="text-numeric inline-flex items-center rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-bold text-danger ring-1 ring-danger/20">
                        {row.maxLate} يوم
                      </span>
                    </td>
                    <td
                      className={cn(
                        "text-numeric py-3 text-left font-bold text-danger",
                        privacy && "privacy-blur",
                      )}
                    >
                      {money(row.balance)}
                    </td>
                    <td className="py-3 text-left">
                      {row.customer.phone && (
                        <a
                          href={`tel:${row.customer.phone}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/25 transition hover:bg-primary/20 active:scale-[0.95]"
                          title="اتصال"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </BezelCard>
    </Reveal>
  );
}