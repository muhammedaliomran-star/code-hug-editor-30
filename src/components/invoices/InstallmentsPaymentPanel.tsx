import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { fmt } from "@/lib/store";

export interface InstallmentsPaymentPanelProps {
  totalPrice: number;
  down: string;
  onDownChange: (v: string) => void;
  remaining: number;
  count: string;
  onCountChange: (v: string) => void;
  monthly: string;
  onMonthlyChange: (v: string) => void;
  date: Date | undefined;
  onDateChange: (d: Date | undefined) => void;
  schedule: { n: number; due: Date; amount: number }[];
  totalDue: number;
  countNum: number;
}

export function InstallmentsPaymentPanel({
  totalPrice,
  down,
  onDownChange,
  remaining,
  count,
  onCountChange,
  monthly,
  onMonthlyChange,
  date,
  onDateChange,
  schedule,
  totalDue,
  countNum,
}: InstallmentsPaymentPanelProps) {
  return (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          المقدم (ج.م)
                        </Label>
                        <Input
                          type="number"
                          value={down}
                          onChange={(e) => onDownChange(e.target.value)}
                        />
                        <div className="flex flex-wrap gap-2 mt-2">
                          {[
                            { pct: 0, label: "بدون مقدم" },
                            { pct: 10, label: "10%" },
                            { pct: 25, label: "25%" },
                            { pct: 50, label: "50%" },
                          ].map((btn) => (
                            <button
                              key={btn.pct}
                              type="button"
                              onClick={() =>
                                onDownChange(String(Math.round((totalPrice * btn.pct) / 100)))
                              }
                              className="rounded-xl bg-white/[0.05] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 hover:bg-foreground/[0.08] hover:text-foreground active:scale-95"
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between gap-3 rounded-2xl bg-foreground/[0.06] px-4 py-3">
                        <span className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold leading-none tracking-tight text-foreground">
                          {fmt(remaining)} ج.م
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          المتبقي للتقسيط
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <Label className="text-xs">عدد الأقساط</Label>
                          <Input
                            type="number"
                            value={count}
                            onChange={(e) => onCountChange(e.target.value)}
                            placeholder="مثال: 6"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">القسط الشهري (ج.م)</Label>
                          <Input
                            type="number"
                            value={monthly}
                            onChange={(e) => onMonthlyChange(e.target.value)}
                            className={cn(countNum > 0 && "border-border/30")}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">تاريخ أول قسط</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-between font-normal text-right",
                                  !date && "text-muted-foreground",
                                )}
                              >
                                {date ? (
                                  <span dir="ltr">{format(date, "dd/MM/yyyy")}</span>
                                ) : (
                                  <span>DD/MM/YYYY</span>
                                )}
                                <CalendarIcon className="h-4 w-4 opacity-60" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={date}
                                onSelect={onDateChange}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      {schedule.length > 0 && (
                        <div className="space-y-2 rounded-2xl border border-border/30 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-muted-foreground">
                              إجمالي المستحق:{" "}
                              <span className="text-foreground">{fmt(totalDue)} ج.م</span>
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                              معاينة جدول الأقساط
                            </span>
                          </div>
                          <div className="max-h-52 space-y-1 overflow-y-auto pl-1 custom-scrollbar">
                            {schedule.map((row) => (
                              <div
                                key={row.n}
                                className="flex items-center justify-between rounded-xl bg-background/60 px-3 py-1.5 text-xs"
                              >
                                <span className="font-extrabold text-foreground">
                                  {fmt(row.amount)} ج.م
                                </span>
                                <span className="text-muted-foreground">
                                  قسط {row.n} —{" "}
                                  <span dir="ltr">{format(row.due, "dd/MM/yyyy")}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
  );
}
