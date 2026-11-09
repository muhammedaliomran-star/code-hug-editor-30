import React from "react";
import { ReportDatePreset } from "@/lib/reports-engine";
import { Button } from "@/components/ui/button";
import { Calendar, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { DatePickerField } from "@/components/DatePickerField";

interface DateRangeFilterProps {
  preset: ReportDatePreset;
  onSelectPreset: (preset: ReportDatePreset) => void;
  customStartDate: string;
  customEndDate: string;
  onCustomStartChange: (val: string) => void;
  onCustomEndChange: (val: string) => void;
}

const PRESETS: Array<{ id: ReportDatePreset; label: string }> = [
  { id: "today", label: "اليوم" },
  { id: "this_week", label: "هذا الأسبوع" },
  { id: "this_month", label: "هذا الشهر" },
  { id: "last_month", label: "الشهر الماضي" },
  { id: "last_3_months", label: "آخر 3 شهور" },
  { id: "last_6_months", label: "آخر 6 شهور" },
  { id: "this_year", label: "هذا العام" },
  { id: "custom", label: "فترة مخصصة" },
];

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  preset,
  onSelectPreset,
  customStartDate,
  customEndDate,
  onCustomStartChange,
  onCustomEndChange,
}) => {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-3 border border-border shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Filter className="w-3.5 h-3.5" />
          <span>الفترة الزمنية للتقرير:</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectPreset(p.id)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
              preset === p.id
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">من تاريخ:</span>
            <DatePickerField value={customStartDate} onChange={onCustomStartChange} className="h-9 w-36 text-xs" />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">إلى تاريخ:</span>
            <DatePickerField value={customEndDate} onChange={onCustomEndChange} className="h-9 w-36 text-xs" />
          </div>
        </div>
      )}
    </div>
  );
};
