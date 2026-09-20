import { useState } from "react";
import { cn } from "@/lib/utils";
import { type StockItem } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";

export function StockProductPicker({ value, name, stockItems, onPick, onClear }: {
  value?: string;
  name: string;
  stockItems: StockItem[];
  onPick: (item: StockItem) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = stockItems.find((s) => s.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal text-right"
        >
          <ChevronsUpDown className="h-4 w-4 opacity-60 shrink-0" />
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.name : (name || "اختر منتج من المخزون...")}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder="ابحث في المخزون..." />
          <CommandList>
            <CommandEmpty>لا توجد منتجات. أضفها من صفحة المخزون.</CommandEmpty>
            <CommandGroup>
              {stockItems.map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.name}
                  onSelect={() => { onPick(s); setOpen(false); }}
                  className="flex items-center justify-between gap-2"
                >
                  <span className={cn("text-xs", s.quantity > 0 ? "text-muted-foreground" : "text-danger font-bold")}>
                    {s.quantity > 0 ? `متوفر: ${s.quantity}` : "نفد"}
                  </span>
                  <span className="flex items-center gap-2">
                    {value === s.id && <Check className="w-4 h-4 text-success" />}
                    <span className="font-medium">{s.name}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {selected && (
          <div className="border-t p-2">
            <Button type="button" variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => { onClear(); setOpen(false); }}>
              مسح الاختيار
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
