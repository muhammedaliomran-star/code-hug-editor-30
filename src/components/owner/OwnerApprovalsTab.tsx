import React, { useState, useEffect } from "react";
import { fmt, invoiceNumber } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FilterChips } from "@/components/FilterChips";
import {
  ShieldAlert,
  CheckCircle2,
  Plus,
  Check,
  X,
} from "lucide-react";

export interface ApprovalRequest {
  id: string;
  type: "discount" | "cancel_invoice" | "large_expense" | "special_return";
  title: string;
  requestedBy: string;
  amount: number;
  reason: string;
  details: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
  actionAt?: string;
  actionNote?: string;
}

const LOCAL_STORAGE_APPROVALS_KEY = "segilly_owner_approvals_v1";

const INITIAL_REQUESTS: ApprovalRequest[] = [
  {
    id: "appr-1",
    type: "discount",
    title: "طلب خصم استثنائي 800 ج.م على فاتورة تقسيط",
    requestedBy: "أحمد إبراهيم (بائع)",
    amount: 800,
    reason: "عميل قديم اشترى 3 أجهزة ومعه كاش مقدم 50%",
    details: "فاتورة رقم INV-0042 — إجمالي الفاتورة: 24,000 ج.م",
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    status: "pending",
  },
  {
    id: "appr-2",
    type: "large_expense",
    title: "طلب صرف مصروف صيانة وتجديد تكييفات الصالة",
    requestedBy: "محمود حسن (مدير الفرع)",
    amount: 2400,
    reason: "صيانة دورية ضرورية للمكيفات مع تغيير فريون",
    details: "عرض أسعار مقدم من شركة الأمل للتبريد",
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    status: "pending",
  },
  {
    id: "appr-3",
    type: "special_return",
    title: "طلب قبول مرتجع بعد مرور 20 يوماً من الشراء",
    requestedBy: "كريم ممدوح (مسؤول خدمة العملاء)",
    amount: 1500,
    reason: "المنتج بحالته الأصلية تماماً بالكرتونة والعميل يرغب بالاستبدال بفئة أعلى",
    details: "صنف: شاشة سامسونج 32 بوصة سمارت",
    createdAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    status: "pending",
  },
];

export function OwnerApprovalsTab() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_APPROVALS_KEY);
      if (saved) {
        setRequests(JSON.parse(saved));
      } else {
        setRequests(INITIAL_REQUESTS);
        localStorage.setItem(LOCAL_STORAGE_APPROVALS_KEY, JSON.stringify(INITIAL_REQUESTS));
      }
    } catch (e) {
      console.error(e);
      setRequests(INITIAL_REQUESTS);
    }
  }, []);

  const saveRequests = (newRequests: ApprovalRequest[]) => {
    setRequests(newRequests);
    try {
      localStorage.setItem(LOCAL_STORAGE_APPROVALS_KEY, JSON.stringify(newRequests));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDecision = (id: string, decision: "approved" | "rejected") => {
    const note = actionNotes[id]?.trim() || (decision === "approved" ? "تمت الموافقة من المالك" : "تم الرفض من المالك");
    const updated = requests.map((req) => {
      if (req.id === id) {
        return {
          ...req,
          status: decision,
          actionAt: new Date().toISOString(),
          actionNote: note,
        };
      }
      return req;
    });

    saveRequests(updated);
    if (decision === "approved") {
      toast.success("تم اعتماد الطلب والموافقة عليه رسمياً");
    } else {
      toast.error("تم رفض الطلب وإبلاغ البائع");
    }
  };

  const handleCreateDemoRequest = () => {
    const newDemo: ApprovalRequest = {
      id: `appr-${Date.now()}`,
      type: "discount",
      title: `طلب خصم خاص بقيمة ${Math.floor(Math.random() * 500 + 200)} ج.م`,
      requestedBy: "أحمد إبراهيم (بائع الصالة)",
      amount: Math.floor(Math.random() * 500 + 200),
      reason: "تخفيض للعميل لإتمام صفقة بيع جهازين معاً كاش",
      details: `طلب فوري جديد — ${new Date().toLocaleTimeString("ar-EG")}`,
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    saveRequests([newDemo, ...requests]);
    toast.info("تمت إضافة طلب موافقة تجريبي جديد للاختبار");
  };

  const filteredRequests = requests.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-muted-foreground" />
              <span className="text-balance">نظام موافقات واعتمادات المالك (Owner Approvals Center)</span>
            </h2>
            <p className="max-w-[68ch] text-sm text-muted-foreground">
              الطلبات الإدارية الحساسة التي تتطلب إذن مباشر من صاحب المحل (خصومات كبيرة، إلغاءات، مرتجعات خاصة، ومصروفات كبرى).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreateDemoRequest}
              className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-muted transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>طلب تجريبي جديد</span>
            </button>

            <div className="rounded-2xl border border-border/80 bg-card px-4 py-2 text-center">
              <span className="text-xs text-muted-foreground">بانتظار موافقتك</span>
              <div className="text-lg font-black text-foreground">{pendingCount} طلبات</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <FilterChips
        value={filter}
        onChange={(v) => setFilter(v as typeof filter)}
        options={[
          { value: "pending", label: "قيد الانتظار", count: pendingCount },
          { value: "approved", label: "تمت الموافقة", count: requests.filter((r) => r.status === "approved").length },
          { value: "rejected", label: "المرفوضة", count: requests.filter((r) => r.status === "rejected").length },
          { value: "all", label: "الكل", count: requests.length },
        ]}
      />

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="rounded-3xl border border-border/80 bg-card/60 p-12 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-base font-bold text-foreground">صندوق الطلبات فارغ</h3>
          <p className="mt-1 text-xs text-muted-foreground">لا توجد أي طلبات معلقة تتطلب موافقتك في هذا التصنيف.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredRequests.map((req) => {
            const isPending = req.status === "pending";

            return (
              <div
                key={req.id}
                className="flex flex-col justify-between rounded-3xl border border-border/80 bg-card/60 p-6 space-y-4 shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-foreground/[0.06] px-2.5 py-0.5 text-xs font-black text-muted-foreground ring-1 ring-border">
                          {req.type === "discount" && "طلب خصم"}
                          {req.type === "large_expense" && "مصروف كبير"}
                          {req.type === "special_return" && "مرتجع استثنائي"}
                          {req.type === "cancel_invoice" && "إلغاء فاتورة"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(req.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-foreground">{req.title}</h3>
                    </div>

                    <div className="text-left shrink-0">
                      <div className="text-base font-black text-foreground">{fmt(req.amount)} ج.م</div>
                      <span
                        className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-xs font-bold mt-1",
                          req.status === "pending"
                            ? "bg-warning text-black"
                            : req.status === "approved"
                            ? "bg-success text-black"
                            : "bg-danger text-black"
                        )}
                      >
                        {req.status === "pending" ? "بانتظار القرار" : req.status === "approved" ? "معتمد" : "مرفوض"}
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-border/40 text-xs">
                    <div className="flex items-center justify-between py-1.5 text-muted-foreground">
                      <span>مقدم الطلب:</span>
                      <strong className="text-foreground">{req.requestedBy}</strong>
                    </div>
                    <div className="flex items-start justify-between py-1.5 text-muted-foreground">
                      <span>السبب والبيان:</span>
                      <span className="text-foreground font-semibold text-right max-w-[70%]">{req.reason}</span>
                    </div>
                    {req.details && (
                      <div className="py-1.5 text-xs text-muted-foreground">
                        {req.details}
                      </div>
                    )}
                  </div>
                </div>

                {isPending ? (
                  <div className="space-y-3 pt-2 border-t border-border/40">
                    <input
                      type="text"
                      value={actionNotes[req.id] || ""}
                      onChange={(e) => setActionNotes({ ...actionNotes, [req.id]: e.target.value })}
                      placeholder="ملاحظة أو توجيه للبائع (اختياري)..."
                      className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleDecision(req.id, "approved")}
                        className="flex items-center justify-center gap-1.5 h-10 rounded-xl bg-success text-xs font-bold text-black shadow-sm hover:opacity-90 transition"
                      >
                        <Check className="h-4 w-4" />
                        <span>موافقة واعتماد</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDecision(req.id, "rejected")}
                        className="flex items-center justify-center gap-1.5 h-10 rounded-xl bg-danger text-xs font-bold text-black shadow-sm hover:opacity-90 transition"
                      >
                        <X className="h-4 w-4" />
                        <span>رفض الطلب</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground pt-1">
                    القرار: <strong>{req.actionNote || "تم اتخاذ القرار"}</strong> —{" "}
                    {req.actionAt && new Date(req.actionAt).toLocaleDateString("ar-EG")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
