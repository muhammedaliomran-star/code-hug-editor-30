import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User } from "lucide-react";
import { CustomerTypeBadge } from "@/components/CustomerTypeBadge";

export interface PosCustomerSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: any[];
  search: string;
  onSearchChange: (v: string) => void;
  onSelect: (id: string) => void;
}

export function PosCustomerSelectDialog({
  open, onOpenChange, customers, search, onSearchChange, onSelect,
}: PosCustomerSelectDialogProps) {
  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md rounded-3xl text-right" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              اختيار العميل
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ابحث بالاسم أو رقم الهاتف..."
              className="h-10 rounded-xl text-xs"
            />
            <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
              <button
                type="button"
                onClick={() => onSelect("")}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-foreground/5 text-right font-bold text-xs"
              >
                <span>عميل نقدي سريع (افتراضي)</span>
                <Badge variant="secondary" className="text-[11px]">كاش</Badge>
              </button>
              {customers
                .filter(
                  (c) =>
                    !customerSearch.trim() ||
                    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                    c.phone?.includes(customerSearch)
                )
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-foreground/5 text-right transition-colors"
                  >
                    <div>
                      <div className="font-bold text-xs text-foreground">{c.name}</div>
                      {c.phone && <div className="text-[11px] text-muted-foreground font-mono" dir="ltr">{c.phone}</div>}
                    </div>
                    <CustomerTypeBadge type={c.customerType} />
                  </button>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
  );
}
