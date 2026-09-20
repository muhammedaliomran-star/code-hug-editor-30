import { Label } from "@/components/ui/label";
import type { ShopSettings } from "@/lib/store";

export interface TabProps {
  form: ShopSettings;
  set: <K extends keyof ShopSettings>(k: K, v: ShopSettings[K]) => void;
}

export async function shrinkImage(file: File, size = 256): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر معالجة الصورة");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function playTestAlert() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch {
    /* ignore audio context restrictions */
  }
}

export function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[2.5rem] bg-card/60 backdrop-blur-md border border-foreground/5 p-6 shadow-sm">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
          {icon}
        </div>
        <div>
          <h3 className="text-base font-black tracking-tight">{title}</h3>
          {hint && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{hint}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      dir="rtl"
      className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-start gap-4 text-right group"
    >
      <div className="mt-2 text-right">
        <Label className="text-xs font-black tracking-tight group-hover:text-primary transition-colors">
          {label}
        </Label>
        {hint && (
          <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed opacity-75">
            {hint}
          </p>
        )}
      </div>
      <div className="min-w-0 grid gap-1.5 text-right">{children}</div>
    </div>
  );
}
