import type { FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ChangePinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pin: string;
  onPinChange: (pin: string) => void;
  onSubmit: (e: FormEvent) => void;
}

export function ChangePinDialog({ open, onOpenChange, pin, onPinChange, onSubmit }: ChangePinDialogProps) {
  return (
          <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm text-right rounded-3xl p-6">
              <DialogHeader className="text-right pb-2">
                <DialogTitle className="text-base font-black text-foreground">
                  تغيير الرقم السري للمشرف العام
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  ضع الرقم السري الجديد الذي ستستخدمه لتسجيل الدخول لهذه اللوحة.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={onSubmit} className="space-y-4 py-2">
                <div>
                  <Label className="text-xs font-bold text-muted-foreground">الرقم السري الجديد (PIN)</Label>
                  <Input
                    type="password"
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => onPinChange(e.target.value)}
                    className="h-11 text-center font-bold tracking-widest text-lg rounded-2xl mt-1 bg-background"
                    maxLength={8}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 rounded-2xl text-xs font-black bg-primary text-black hover:bg-primary/90"
                >
                  حفظ الرمز السري الجديد
                </Button>
              </form>
            </DialogContent>
          </Dialog>
  );
}
