import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Copy, History, Printer, Receipt, RefreshCw, Sliders } from "lucide-react";
import type { LicenseRecord } from "@/lib/licensing";

export interface ManageLicenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  license: LicenseRecord | null;
  onCopy: (text: string) => void;
  onExtend: (lic: LicenseRecord) => void;
  onPrintCertificate: (lic: LicenseRecord) => void;
  onPrintInvoice: (lic: LicenseRecord) => void;
  onToggleModule: (lic: LicenseRecord, key: string, value: boolean, label: string) => void;
  logNote: string;
  onLogNoteChange: (note: string) => void;
  onAddLog: () => void;
  onDelete: (id: string) => void;
}

export function ManageLicenseDialog({
  open,
  onOpenChange,
  license,
  onCopy,
  onExtend,
  onPrintCertificate,
  onPrintInvoice,
  onToggleModule,
  logNote,
  onLogNoteChange,
  onAddLog,
  onDelete,
}: ManageLicenseDialogProps) {
  return (
          <Dialog open={open} onOpenChange={onOpenChange}>
            {license && (
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto text-right rounded-3xl p-6 space-y-6">
                <DialogHeader className="text-right pb-3 border-b border-foreground/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <DialogTitle className="text-lg font-black text-foreground">
                        إدارة ترخيص: {license.shopName}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground">
                        العميل: {license.clientName} ({license.clientPhone})
                      </DialogDescription>
                    </div>
                    <Badge
                      className={
                        license.status === "active"
                          ? "bg-emerald-600 text-white"
                          : license.status === "trial"
                          ? "bg-amber-600 text-white"
                          : "bg-danger text-white"
                      }
                    >
                      {license.status}
                    </Badge>
                  </div>
                </DialogHeader>

                {/* Key and Quick Actions */}
                <div className="p-4 rounded-2xl bg-background border border-foreground/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">مفتاح الترخيص:</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onCopy(license.key)}
                      className="h-7 text-xs rounded-xl"
                    >
                      <Copy className="w-3 h-3 ml-1" />
                      نسخ المفتاح
                    </Button>
                  </div>
                  <div className="font-mono text-sm font-black text-primary select-all">
                    {license.key}
                  </div>
                </div>

                {/* Status & Validity Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Button
                    onClick={() => onExtend(license)}
                    className="rounded-2xl text-xs font-bold h-11 bg-primary text-black hover:bg-primary/90 gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4" />
                    تمديد الترخيص سنة
                  </Button>

                  <Button
                    onClick={() => onPrintCertificate(license)}
                    variant="outline"
                    className="rounded-2xl text-xs font-bold h-11 gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    طباعة شهادة الترخيص
                  </Button>

                  <Button
                    onClick={() => onPrintInvoice(license)}
                    variant="outline"
                    className="rounded-2xl text-xs font-bold h-11 gap-1.5"
                  >
                    <Receipt className="w-4 h-4" />
                    طباعة الفاتورة الرسمية
                  </Button>
                </div>

                {/* Modules & Permissions Customizer */}
                <div className="p-5 rounded-2xl bg-foreground/[0.02] border border-foreground/10 space-y-4">
                  <h4 className="text-xs font-black text-foreground flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-primary" />
                    تخصيص الموديولات والصلاحيات المفعلة لهذا العميل:
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    {[
                      { key: "allowPos", label: "نقاط البيع السريعة" },
                      { key: "allowWarehouse", label: "إدارة المخازن والباركود" },
                      { key: "allowInstallments", label: "نظام الأقساط والديون" },
                      { key: "allowWhatsApp", label: "إرسال إيصالات واتساب" },
                      { key: "allowMultiBranch", label: "الربط متعدد الفروع" },
                    ].map((mod) => (
                      <div
                        key={mod.key}
                        className="p-3 rounded-xl bg-background border border-foreground/10 flex items-center justify-between"
                      >
                        <span className="font-bold">{mod.label}</span>
                        <Switch
                          checked={(license.modules as any)[mod.key]}
                          onCheckedChange={(val) => onToggleModule(license, mod.key, val, mod.label)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Support Notes & Audit Log */}
                <div className="p-5 rounded-2xl bg-foreground/[0.02] border border-foreground/10 space-y-4">
                  <h4 className="text-xs font-black text-foreground flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    سجل التدقيق والمتابعات الفنية (Support & Audit Logs):
                  </h4>

                  <div className="flex gap-2">
                    <Input
                      placeholder="أضف ملاحظة دعم فني أو تدريب أو متابعة..."
                      value={logNote}
                      onChange={(e) => onLogNoteChange(e.target.value)}
                      className="h-10 text-xs rounded-2xl bg-background flex-1"
                    />
                    <Button
                      onClick={onAddLog}
                      className="h-10 px-5 rounded-2xl text-xs font-bold bg-primary text-black hover:bg-primary/90"
                    >
                      إضافة للسجل
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(license.supportLogs || []).map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-background border border-foreground/5 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                          <span>
                            {log.date} — <strong>{log.author}</strong> ({log.action})
                          </span>
                        </div>
                        <p className="text-foreground font-medium">{log.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <DialogFooter className="pt-3 border-t border-foreground/10 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={() => onDelete(license.id)}
                    className="text-danger rounded-2xl text-xs"
                  >
                    حذف هذا الترخيص
                  </Button>
                  <Button
                    onClick={() => onOpenChange(false)}
                    className="rounded-2xl h-11 px-8 text-xs font-bold"
                  >
                    حفظ وإغلاق
                  </Button>
                </DialogFooter>
              </DialogContent>
            )}
          </Dialog>
  );
}
