import { useCallback, useEffect, useState } from "react";

/** True when the error is the missing-server-env platform failure. */
export function isMissingEnvError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /Missing Supabase environment variable/i.test(msg);
}

/** Arabic, actionable message for server-fn failures. */
export function friendlyServerFnError(e: unknown, fallback: string): string {
  if (isMissingEnvError(e)) {
    return "خدمة الخادم غير مربوطة حالياً (Supabase) — تحقق من الربط في لوحة التحكم ثم أعد المحاولة";
  }
  return e instanceof Error ? e.message : fallback;
}

const RETRY_DELAYS_MS = [1000, 2000, 4000];

/**
 * Call a server function, retrying ONLY the transient missing-env failure
 * (platform injection flakiness). Anything else throws immediately — in
 * particular destructive ops are never blindly retried past the gate.
 */
export async function callServerFn<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      if (!isMissingEnvError(e) || attempt >= RETRY_DELAYS_MS.length) throw e;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      attempt++;
    }
  }
}

export type DeploymentHealth = {
  /** null = still checking / server unreachable (stays silent, no false alarm). */
  linked: boolean | null;
  refresh: () => void;
};

/** Probe once on mount whether the server runtime has Supabase wired. */
export function useDeploymentHealth(): DeploymentHealth {
  const [linked, setLinked] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { getDeploymentHealth } = await import("./health.functions");
      const res = await getDeploymentHealth();
      setLinked(res.supabaseLinked);
    } catch {
      // Unreachable (offline etc.) — stay unknown rather than false-alarm.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { linked, refresh };
}
