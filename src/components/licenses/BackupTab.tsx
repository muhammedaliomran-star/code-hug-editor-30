import type { ChangeEvent } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";

export interface BackupTabProps {
  onExportJson: () => void;
  onImportJson: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function BackupTab({ onExportJson, onImportJson }: BackupTabProps) {
  return (
            <TabsContent value="backup" className="space-y-6">
              <div className="p-6 rounded-3xl bg-foreground/[0.02] border border-foreground/10 space-y-4">
                <div>
                  <h3 className="text-base font-black text-foreground flex items-center gap-2">
                    <Download className="w-5 h-5 text-primary" />
                    تصدير واستيراد قاعدة بيانات المشتركين والتراخيص
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    يمكنك حفظ نسخة احتياطية كاملة من بيانات التراخيص والإيرادات على جهازك بأمان، أو استعادتها في أي وقت.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="py-2 space-y-3">
                    <h4 className="font-bold text-sm text-foreground">تصدير نسخة احتياطية (JSON)</h4>
                    <p className="text-xs text-muted-foreground">
                      تنزيل ملف يحتوي على كافة بيانات المشتركين، المفاتيح، وسجلات الدعم والأقساط.
                    </p>
                    <Button
                      onClick={onExportJson}
                      className="w-full rounded-2xl text-xs font-bold h-11 bg-primary text-black hover:bg-primary/90"
                    >
                      <Download className="w-4 h-4 ml-1.5" />
                      تنزيل ملف النسخة الاحتياطية
                    </Button>
                  </div>

                  <div className="py-2 space-y-3">
                    <h4 className="font-bold text-sm text-foreground">استيراد واستعادة بيانات</h4>
                    <p className="text-xs text-muted-foreground">
                      اختر ملف JSON محفوظ مسبقاً لاستعادة قائمة المشتركين كاملة.
                    </p>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".json"
                        onChange={onImportJson}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                      />
                      <Button
                        variant="outline"
                        className="w-full rounded-2xl text-xs font-bold h-11 gap-1.5"
                      >
                        <Upload className="w-4 h-4 ml-1.5" />
                        اختيار ملف الاستعادة
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
  );
}
