import { useBranches } from "./context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeftRight, Trash2, CheckCircle2 } from "lucide-react";

export function CreateTransferDialog() {
  const {
    branches, stockItems,
    isCreateTransferOpen, setIsCreateTransferOpen,
    transferFrom, setTransferFrom,
    transferTo, setTransferTo,
    transferDriver, setTransferDriver,
    transferNotes, setTransferNotes,
    transferItems, setTransferItems,
    handleAddTransferItem, handleCreateTransferSubmit,
  } = useBranches();

  return (
    <Dialog open={isCreateTransferOpen} onOpenChange={setIsCreateTransferOpen}>
      <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden rounded-2xl border border-foreground/10 shadow-lg" dir="rtl">
        <div className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-card px-6 py-5">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            إنشاء أمر تحويل ونقل بضائع
          </DialogTitle>
        </div>
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">فرع المصدر (الإرسال) *</Label>
              <Select value={transferFrom} onValueChange={setTransferFrom}>
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue placeholder="اختر فرع المصدر" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">فرع الوجهة (الاستلام) *</Label>
              <Select value={transferTo} onValueChange={setTransferTo}>
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue placeholder="اختر فرع الوجهة" />
                </SelectTrigger>
                <SelectContent>
                  {branches.filter((b) => b.id !== transferFrom).map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">اسم السائق / شركة النقل (اختياري)</Label>
            <Input
              placeholder="مثلاً: كابتن محمود - 010..."
              value={transferDriver}
              onChange={(e) => setTransferDriver(e.target.value)}
              className="h-10 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-2 pt-2">
            <Label className="text-xs font-bold">اختيار الأصناف المراد تحويلها:</Label>
            <Select onValueChange={(val) => {
              const found = stockItems.find((s) => s.id === val);
              if (found) handleAddTransferItem(found);
            }}>
              <SelectTrigger className="h-10 rounded-xl text-xs bg-muted/30">
                <SelectValue placeholder="🔍 اضغط للبحث واختيار صنف..." />
              </SelectTrigger>
              <SelectContent>
                {stockItems.map((st) => (
                  <SelectItem key={st.id} value={st.id} className="text-xs">
                    {st.name} (المتاح إجمالاً: {st.quantity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {transferItems.length > 0 && (
            <div className="rounded-xl border border-foreground/10 overflow-hidden text-xs">
              <table className="w-full text-right">
                <thead className="bg-muted/40 font-bold text-muted-foreground border-b border-[var(--hairline)]">
                  <tr>
                    <th className="p-2.5">الصنف</th>
                    <th className="p-2.5 text-center w-28">الكمية المحولة</th>
                    <th className="p-2.5 text-left w-12">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hairline)]">
                  {transferItems.map((item, idx) => (
                    <tr key={item.stockItemId}>
                      <td className="p-2.5 font-bold">{item.name}</td>
                      <td className="p-2.5 text-center">
                        <Input
                          type="number"
                          min={1}
                          value={item.sentQty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setTransferItems((prev) =>
                              prev.map((i, iIdx) =>
                                iIdx === idx ? { ...i, sentQty: val, requestedQty: val } : i
                              )
                            );
                          }}
                          className="h-8 w-20 text-center mx-auto rounded-lg font-bold"
                        />
                      </td>
                      <td className="p-2.5 text-left">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-danger rounded-full"
                          onClick={() => setTransferItems((prev) => prev.filter((_, iIdx) => iIdx !== idx))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">ملاحظات التحويل</Label>
            <Input
              placeholder="تعليمات خاصة بالشحن أو التخزين..."
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
              className="h-10 rounded-xl text-xs"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleCreateTransferSubmit} className="flex-1 h-10 rounded-xl font-bold text-xs">
              حفظ أمر التحويل
            </Button>
            <Button variant="outline" onClick={() => setIsCreateTransferOpen(false)} className="h-10 rounded-xl text-xs">
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ReceiveTransferDialog() {
  const {
    receiveModalOpen, setReceiveModalOpen,
    receiveTargetTransfer,
    receivedItemInputs, setReceivedItemInputs,
    handleConfirmReceive,
  } = useBranches();

  return (
    <Dialog open={receiveModalOpen} onOpenChange={setReceiveModalOpen}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden rounded-2xl border border-foreground/10 shadow-lg" dir="rtl">
        <div className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-card px-6 py-5">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            تأكيد استلام وفحص الشحنة ({receiveTargetTransfer?.transferNumber})
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            أدخل الكميات السليمة المستلمة والتوالف إن وجدت قبل اعتماد الإيداع بمخزن الفرع
          </DialogDescription>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="divide-y divide-[var(--hairline)]">
            {receiveTargetTransfer?.items.map((item) => {
              const currentInput = receivedItemInputs[item.stockItemId] || {
                receivedQty: item.sentQty,
                damagedQty: 0,
                notes: "",
              };

              return (
                <div key={item.stockItemId} className="py-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold">{item.name}</span>
                    <span className="text-muted-foreground">المشحون: <strong>{item.sentQty}</strong> قطعة</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] text-emerald-600 font-bold">الكمية السليمة المستلمة</Label>
                      <Input
                        type="number"
                        min={0}
                        value={currentInput.receivedQty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setReceivedItemInputs((prev) => ({
                            ...prev,
                            [item.stockItemId]: { ...prev[item.stockItemId], receivedQty: val },
                          }));
                        }}
                        className="h-8 rounded-lg text-center font-bold text-xs"
                      />
                    </div>

                    <div>
                      <Label className="text-[10px] text-danger font-bold">الكمية التالفة / المفقودة</Label>
                      <Input
                        type="number"
                        min={0}
                        value={currentInput.damagedQty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setReceivedItemInputs((prev) => ({
                            ...prev,
                            [item.stockItemId]: { ...prev[item.stockItemId], damagedQty: val },
                          }));
                        }}
                        className="h-8 rounded-lg text-center font-bold text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 pt-3">
            <Button onClick={handleConfirmReceive} className="flex-1 h-10 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700">
              اعتماد الاستلام وإيداع المخزون
            </Button>
            <Button variant="outline" onClick={() => setReceiveModalOpen(false)} className="h-10 rounded-xl text-xs">
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
