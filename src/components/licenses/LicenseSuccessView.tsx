import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, Copy, MessageCircle, Printer, Receipt } from "lucide-react";
import type { LicenseRecord } from "@/lib/licensing";

export interface LicenseSuccessViewProps {
  result: LicenseRecord;
  onCopy: (key: string) => void;
  onPrintCertificate: (lic: LicenseRecord) => void;
  onPrintInvoice: (lic: LicenseRecord) => void;
  onSendWhatsApp: (lic: LicenseRecord) => void;
  onClose: () => void;
}

export function LicenseSuccessView({
  result,
  onCopy,
  onPrintCertificate,
  onPrintInvoice,
  onSendWhatsApp,
  onClose,
}: LicenseSuccessViewProps) {
  return (
                <div className="space-y-6 py-4">
                  <div className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                    <h3 className="text-lg font-black text-foreground">تم إنشاء وتفعيل الترخيص بنجاح!</h3>
                    <p className="text-xs text-muted-foreground">
                      المنشأة: <strong>{result.shopName}</strong> — العميل: {result.clientName}
                    </p>

                    {/* Big Key Display */}
                    <div className="p-4 rounded-2xl bg-background border border-foreground/10 flex items-center justify-center gap-3">
                      <span className="font-mono text-lg font-black text-primary tracking-widest select-all">
                        {result.key}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onCopy(result.key)}
                        className="rounded-xl h-8 px-3 text-xs"
                      >
                        <Copy className="w-3.5 h-3.5 ml-1" />
                        نسخ
                      </Button>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Button
                      onClick={() => onPrintCertificate(result)}
                      className="rounded-2xl h-11 text-xs font-bold bg-foreground/10 hover:bg-foreground/15 text-foreground gap-1.5"
                    >
                      <Printer className="w-4 h-4" />
                      طباعة شهادة الترخيص
                    </Button>

                    <Button
                      onClick={() => onPrintInvoice(result)}
                      className="rounded-2xl h-11 text-xs font-bold bg-foreground/10 hover:bg-foreground/15 text-foreground gap-1.5"
                    >
                      <Receipt className="w-4 h-4" />
                      طباعة فاتورة رسمية
                    </Button>

                    <Button
                      onClick={() => onSendWhatsApp(result)}
                      className="rounded-2xl h-11 text-xs font-bold bg-[#25D366] hover:bg-[#20ba59] text-white gap-1.5"
                    >
                      <MessageCircle className="w-4 h-4" />
                      إرسال للعميل واتساب
                    </Button>
                  </div>

                  <DialogFooter className="pt-3 border-t border-foreground/10">
                    <Button
                      onClick={onClose}
                      className="rounded-2xl h-11 px-8 text-xs font-black bg-primary text-black hover:bg-primary/90"
                    >
                      إغلاق والعودة للوحة
                    </Button>
                  </DialogFooter>
                </div>
  );
}
