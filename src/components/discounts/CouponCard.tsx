import { Award, Calendar, Check, Copy, Edit2, MessageCircle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCouponStatus, type PromoCoupon } from "@/lib/discounts";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface CouponCardProps {
  coupon: PromoCoupon;
  copiedCode: string | null;
  onCopy: (code: string) => void;
  onWhatsAppShare: (coupon: PromoCoupon) => void;
  onToggleStatus: (id: string) => void;
  onEdit: (coupon: PromoCoupon) => void;
  onDelete: (id: string) => void;
}

export function CouponCard({
  coupon,
  copiedCode,
  onCopy,
  onWhatsAppShare,
  onToggleStatus,
  onEdit,
  onDelete,
}: CouponCardProps) {
  const status = getCouponStatus(coupon);
  const usagePct =
    coupon.maxUsage !== null && coupon.maxUsage > 0
      ? Math.min(100, (coupon.usedCount / coupon.maxUsage) * 100)
      : 0;

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl p-4 transition-all duration-300 border bg-card/80 hover:shadow-md hover:border-primary/40",
        status.status === "inactive" && "opacity-75 bg-muted/20",
        status.status === "expired" && "border-warning/30",
        coupon.isLoyaltyReward && "border-warning/50 bg-warning/[0.02]",
      )}
    >
      {/* Card Header */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "px-2.5 py-1 rounded-xl font-mono text-sm font-black tracking-wider flex items-center gap-1.5 border shadow-2xs",
                coupon.discountType === "percentage"
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-warning/10 text-warning border-warning/20",
              )}
            >
              {coupon.code}
            </span>
            <button
              type="button"
              onClick={() => onCopy(coupon.code)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
              title="نسخ الكود"
            >
              {copiedCode === coupon.code ? (
                <Check className="w-3.5 h-3.5 text-success" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-1">
            {coupon.isLoyaltyReward && (
              <Badge
                variant="outline"
                className="text-[11px] bg-warning/10 text-warning border-warning/30 gap-1 py-0.5"
              >
                <Award className="w-2.5 h-2.5" /> مكافأة ولاء
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn(
                "text-[11px] font-bold py-0.5",
                status.color === "success" && "bg-success/10 text-success border-success/30",
                status.color === "warning" && "bg-warning/10 text-warning border-warning/30",
                status.color === "danger" && "bg-danger/10 text-danger border-danger/30",
                status.color === "muted" && "bg-muted text-muted-foreground border-border/40",
              )}
            >
              {status.label}
            </Badge>
          </div>
        </div>

        <h2 className="font-bold text-sm text-foreground line-clamp-1">{coupon.title}</h2>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl font-black text-foreground font-mono">
            {coupon.discountType === "percentage"
              ? `خصم ${coupon.discountValue}%`
              : `خصم ${fmt(coupon.discountValue)} ج.م`}
          </span>
          {coupon.minOrderValue > 0 && (
            <span className="text-[11px] text-muted-foreground">
              (حد أدنى: {fmt(coupon.minOrderValue)} ج.م)
            </span>
          )}
        </div>

        {coupon.notes && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
            {coupon.notes}
          </p>
        )}
      </div>

      {/* Card Footer Info */}
      <div className="mt-4 pt-3 border-t border-border/30 space-y-2.5 text-xs text-muted-foreground">
        {/* Usage Count Progress */}
        <div className="flex items-center justify-between text-[11px]">
          <span>
            الاستخدام: <strong className="text-foreground font-mono">{coupon.usedCount}</strong>
            {coupon.maxUsage !== null && <span> من {coupon.maxUsage}</span>}
          </span>
          {coupon.maxUsage !== null && (
            <span className="font-mono text-[11px] text-muted-foreground">{usagePct.toFixed(0)}%</span>
          )}
        </div>

        {coupon.maxUsage !== null && (
          <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                usagePct >= 100 ? "bg-danger" : usagePct > 70 ? "bg-warning" : "bg-primary",
              )}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        )}

        {/* Validity Date */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {coupon.endsAt
              ? `ينتهي: ${new Date(coupon.endsAt).toLocaleDateString("ar-EG")}`
              : "مفتوح بدون تاريخ انتهاء"}
          </span>

          {coupon.customerEligibility !== "all" && (
            <span className="px-1.5 py-0.5 rounded bg-muted/60 text-[11px] font-medium">
              {coupon.customerEligibility === "vip"
                ? "مميزين VIP"
                : coupon.customerEligibility === "cash"
                  ? "دفع نقدي"
                  : "عملاء أقساط"}
            </span>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-border/20">
          {/* WhatsApp Share Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onWhatsAppShare(coupon)}
            className="h-10 px-3 rounded-lg text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/30 gap-1.5"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
            واتساب
          </Button>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onToggleStatus(coupon.id)}
              className="h-10 px-3 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              {coupon.active ? "تعطيل" : "تفعيل"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onEdit(coupon)}
              className="h-10 w-10 text-muted-foreground hover:text-primary"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onDelete(coupon.id)}
              className="h-10 w-10 text-muted-foreground hover:text-danger"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
