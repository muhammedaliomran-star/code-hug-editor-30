import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreVertical,
  Copy,
  Printer,
  Sliders,
  Users,
  RefreshCw,
  FileText,
  Receipt,
  MessageCircle,
  Trash2,
} from "lucide-react";
import {
  calculateDaysRemaining,
  generateLicenseWhatsAppMessage,
  printLicenseCertificate,
  printLicenseCommercialInvoice,
  type LicenseRecord,
} from "@/lib/licensing";

export interface AdminLicenseCardProps {
  license: LicenseRecord;
  onManage: (license: LicenseRecord) => void;
  onExtend: (license: LicenseRecord) => void;
  onDelete: (license: LicenseRecord) => void;
  onWhatsApp: (phone: string, message: string) => void;
  onCopy: (text: string) => void;
}

export function AdminLicenseCard({
  license,
  onManage,
  onExtend,
  onDelete,
  onWhatsApp,
  onCopy,
}: AdminLicenseCardProps) {
  const { days, isLifetime, isExpired } = calculateDaysRemaining(license.expiryDate);
  const isTrial = license.status === "trial";

  return (
    <div className="p-5 rounded-3xl bg-foreground/[0.02] border border-foreground/10 hover:border-primary/40 transition-all space-y-4 relative flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base text-foreground">{license.shopName}</h3>
              {license.status === "active" ? (
                <Badge className="bg-emerald-600 text-white text-[10px]">ساري</Badge>
              ) : isTrial ? (
                <Badge variant="secondary" className="text-amber-600 text-[10px]">تجريبي</Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px]">منتهي</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Users className="w-3 h-3" />
              {license.clientName} ({license.clientPhone})
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-right text-xs">
              <DropdownMenuItem onClick={() => onManage(license)}>
                <Sliders className="w-3.5 h-3.5 ml-2 text-primary" />
                إدارة الترخيص والصلاحيات
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => printLicenseCertificate(license)}>
                <Printer className="w-3.5 h-3.5 ml-2 text-muted-foreground" />
                طباعة شهادة الترخيص
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => printLicenseCommercialInvoice(license, "invoice")}>
                <Receipt className="w-3.5 h-3.5 ml-2 text-emerald-600" />
                طباعة فاتورة بيع رسمية
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => printLicenseCommercialInvoice(license, "quotation")}>
                <FileText className="w-3.5 h-3.5 ml-2 text-blue-600" />
                طباعة عرض سعر (Quotation)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExtend(license)}>
                <RefreshCw className="w-3.5 h-3.5 ml-2 text-primary" />
                تمديد سنة إضافية
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onWhatsApp(license.clientPhone, generateLicenseWhatsAppMessage(license))}
              >
                <MessageCircle className="w-3.5 h-3.5 ml-2 text-emerald-500" />
                إرسال المفتاح عبر واتساب
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(license)} className="text-danger">
                <Trash2 className="w-3.5 h-3.5 ml-2" />
                حذف الترخيص
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="p-3 rounded-2xl bg-background border border-foreground/10 flex items-center justify-between gap-2">
          <div className="truncate font-mono text-xs font-black text-primary tracking-wider select-all">
            {license.key}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCopy(license.key)}
            className="h-7 w-7 rounded-lg shrink-0"
          >
            <Copy className="w-3 h-3 text-muted-foreground" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2 rounded-xl bg-foreground/[0.02] border border-foreground/5">
            <span className="text-muted-foreground">الباقة: </span>
            <span className="font-bold text-foreground">{license.tierLabel}</span>
          </div>

          <div className="p-2 rounded-xl bg-foreground/[0.02] border border-foreground/5">
            <span className="text-muted-foreground">الصلاحية: </span>
            <span
              className={`font-bold ${
                isLifetime ? "text-primary" : isExpired ? "text-danger" : "text-foreground"
              }`}
            >
              {isLifetime ? "مدى الحياة" : isExpired ? "انتهى" : `${days} يوم متبقي`}
            </span>
          </div>
        </div>

        {license.installments && license.installments.remainingBalance > 0 && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
            <span className="text-amber-700 dark:text-amber-400 font-bold">متبقي بالأقساط:</span>
            <span className="font-black text-amber-700 dark:text-amber-400">
              {license.installments.remainingBalance.toLocaleString()} ج.م
            </span>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-foreground/5 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onManage(license)}
          className="w-full rounded-xl text-xs font-bold h-9"
        >
          <Sliders className="w-3.5 h-3.5 ml-1 text-primary" />
          التفاصيل والتعديل
        </Button>

        <Button
          size="sm"
          onClick={() => printLicenseCertificate(license)}
          className="h-9 px-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground"
        >
          <Printer className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
