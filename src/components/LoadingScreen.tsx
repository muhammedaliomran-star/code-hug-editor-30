import { Loader2 } from "lucide-react";

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={
        "block overflow-hidden rounded-full bg-foreground/[0.07] " +
        "relative after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.6s_infinite] " +
        "after:bg-gradient-to-l after:from-transparent after:via-foreground/[0.08] after:to-transparent " +
        className
      }
    />
  );
}

export function PageLoadingSkeleton({ type = "table" }: { type?: "table" | "cards" | "form" }) {
  if (type === "cards") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-[1.5rem] p-5 h-28">
            <Shimmer className="h-3 w-24" />
            <Shimmer className="mt-4 h-6 w-32" />
            <Shimmer className="mt-3 h-2.5 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (type === "form") {
    return (
      <div className="glass rounded-[1.5rem] p-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="glass rounded-2xl p-4 flex items-center gap-4"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <Shimmer className="h-11 w-11 shrink-0 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-3.5 w-1/3" />
            <Shimmer className="h-2.5 w-1/5" />
          </div>
          <Shimmer className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-12 h-12" : "w-8 h-8";
  return <Loader2 className={`animate-spin ${sizeClass}`} />;
}
