import { useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import type { Matcher } from "react-day-picker";
import { CalendarDays, Check, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerFieldProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  "aria-label"?: string;
  disabledDates?: Matcher | Matcher[];
}

function parseValue(value?: string) {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

export function DatePickerField({
  value,
  onChange,
  placeholder = "اختار التاريخ",
  className,
  disabled,
  id,
  name,
  "aria-label": ariaLabel,
  disabledDates,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseValue(value), [value]);

  const selectDate = (date?: Date) => {
    if (!date) return;
    onChange(format(date, "yyyy-MM-dd"));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name && <input type="hidden" name={name} value={value || ""} />}
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-expanded={open}
          className={cn(
            "group h-10 w-full justify-between gap-3 rounded-xl border-border/60 bg-background/70 px-3 text-right font-medium transition-[border-color,background-color,box-shadow,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-primary/40 hover:bg-primary/[0.04] active:scale-[0.99]",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary/80 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-110" />
            <span dir="ltr" className="truncate text-xs">
              {selected ? format(selected, "dd/MM/yyyy", { locale: ar }) : placeholder}
            </span>
          </span>
          <span className="text-[10px] font-bold text-muted-foreground">فتح</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        dir="rtl"
        className="w-auto rounded-2xl border-border/70 bg-card/95 p-2 shadow-[0_24px_70px_-28px_hsl(0_0%_0%/0.8)] backdrop-blur-xl"
      >
        <div className="rounded-xl border border-border/50 bg-background/50 p-1">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={selectDate}
            locale={ar}
            initialFocus
            captionLayout="dropdown"
            fromYear={new Date().getFullYear() - 10}
            toYear={new Date().getFullYear() + 10}
            disabled={disabledDates}
            className="p-2"
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/50 pt-2">
          <button
            type="button"
            onClick={() => selectDate(new Date())}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-primary transition-[background-color,color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-primary/10 active:scale-[0.98]"
          >
            <Check className="h-3.5 w-3.5" />
            اليوم
          </button>
          {selected && (
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground transition-[background-color,color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-danger/10 hover:text-danger active:scale-[0.98]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              مسح
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
