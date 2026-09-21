import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { getOrderPayments, type StorefrontPayment } from "@/lib/storefront";
import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function PaymentComplete() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("order_id");
  const urlStatus = params.get("status");
  const [payments, setPayments] = useState<StorefrontPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderPublicNumber, setOrderPublicNumber] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    // Poll for payment status — webhook may take a moment
    let attempts = 0;
    const maxAttempts = 10;
    const poll = async () => {
      try {
        const { data: order } = await supabase
          .from("store_orders")
          .select("public_number, payment_status")
          .eq("id", orderId)
          .single();
        if (order?.public_number) setOrderPublicNumber(order.public_number);
        if (order?.payment_status === "paid" || order?.payment_status === "failed" || attempts >= maxAttempts) {
          const { data: payData } = await supabase
            .from("storefront_payments")
            .select("*")
            .eq("order_id", orderId)
            .order("created_at", { ascending: false });
          setPayments((payData ?? []) as StorefrontPayment[]);
          setLoading(false);
          return;
        }
        attempts++;
        setTimeout(poll, 2000);
      } catch {
        attempts++;
        if (attempts >= maxAttempts) { setLoading(false); return; }
        setTimeout(poll, 2000);
      }
    };
    poll();
  }, [orderId]);

  const latestPayment = payments[0];
  const paid = latestPayment?.status === "success" || urlStatus === "success";

  const trackUrl = orderPublicNumber ? `${window.location.origin}/track?num=${orderPublicNumber}` : "";

  return (
    <AppShell>
      <div className="grid min-h-[60vh] place-items-center px-4">
        <div className="w-full max-w-md text-center">
          {loading ? (
            <div className="space-y-4">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
              <p className="text-lg font-bold">جاري التحقق من حالة الدفع...</p>
              <p className="text-sm text-muted-foreground">لوحة الدفع بتجري الeta تأكيد، انتظر شوية</p>
            </div>
          ) : paid ? (
            <div className="space-y-4">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-900">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-black">تم الدفع بنجاح ✅</h1>
              <p className="text-muted-foreground">تم تأكيد الدفع والطلب بنجاح. هتوصلك تفاصيل الطلب قريباً.</p>
              {orderPublicNumber && (
                <div className="rounded-2xl border bg-card p-4 text-sm">
                  <p className="text-muted-foreground">رقم الطلب</p>
                  <p className="text-lg font-black tracking-widest">{orderPublicNumber}</p>
                </div>
              )}
              {latestPayment && (
                <div className="rounded-2xl border bg-card p-4 text-right text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">المبلغ</span><span className="font-bold">{(latestPayment.amount_cents / 100).toFixed(2)} {latestPayment.currency}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">طريقة الدفع</span><span>{latestPayment.payment_method === "card" ? "كارت ائتمان" : latestPayment.payment_method === "wallet" ? "محفظة إلكترونية" : latestPayment.payment_method ?? "—"}</span></div>
                </div>
              )}
              <div className="flex flex-col gap-2 pt-2">
                {trackUrl && <Button asChild className="gap-2"><a href={trackUrl}><ExternalLink className="h-4 w-4" /> تتبع الطلب</a></Button>}
                <Button variant="outline" onClick={() => window.location.href = "/"}>رجوع للمتجر</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-rose-100 dark:bg-rose-900">
                <XCircle className="h-8 w-8 text-rose-600" />
              </div>
              <h1 className="text-2xl font-black">فشل الدفع</h1>
              <p className="text-muted-foreground">الدفع ما ات affirmedش. جرب تاني أو اختار الدفع عند الاستلام.</p>
              {latestPayment && (
                <div className="rounded-2xl border bg-card p-4 text-right text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">المبلغ</span><span className="font-bold">{(latestPayment.amount_cents / 100).toFixed(2)} {latestPayment.currency}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">الحالة</span><span className="text-rose-600 font-bold">فشل</span></div>
                </div>
              )}
              <div className="flex flex-col gap-2 pt-2">
                {orderPublicNumber && <Button asChild className="gap-2"><a href={`${window.location.origin}/track?num=${orderPublicNumber}`}><ExternalLink className="h-4 w-4" /> تتبع الطلب</a></Button>}
                <Button variant="outline" onClick={() => window.location.href = "/"}>رجوع للمتجر</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
