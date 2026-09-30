/**
 * Runtime Supabase config — independence from build-time env.
 *
 * Problem it solves: Vite bakes VITE_* vars at BUILD time. If the deploy
 * pipeline ever builds without them, every bundle is born broken and no
 * republish can fix it. This loader fetches /app-config.json (public file,
 * publishable key only — public by design, RLS is the real defense) as a
 * fallback source, resolved BEFORE first Supabase use via root beforeLoad.
 */

export interface RuntimeAppConfig {
  url?: string;
  key?: string;
}

let cached: RuntimeAppConfig | null | undefined;

export function getRuntimeConfig(): RuntimeAppConfig | null {
  return cached ?? null;
}

/** Which source resolved the client credentials (for one-line diagnostics). */
export function describeEnvSource(): "build-env" | "runtime-config" | "process-env" | "missing" {
  if (typeof import.meta !== "undefined") {
    try {
      const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
      if (env?.["VITE_SUPABASE_URL"] && env?.["VITE_SUPABASE_PUBLISHABLE_KEY"]) return "build-env";
    } catch {
      // ignore
    }
  }
  if (cached?.url && cached?.key) return "runtime-config";
  if (typeof process !== "undefined" && process.env?.["SUPABASE_URL"]) return "process-env";
  return "missing";
}

export async function loadAppConfig(): Promise<void> {
  if (cached !== undefined) return;
  if (typeof window === "undefined") {
    cached = null;
    return;
  }
  try {
    const res = await fetch("/app-config.json", { cache: "no-store" });
    if (!res.ok) {
      cached = null;
      return;
    }
    const json = (await res.json()) as Record<string, unknown>;
    const url = typeof json["SUPABASE_URL"] === "string" ? json["SUPABASE_URL"] : undefined;
    const key =
      typeof json["SUPABASE_PUBLISHABLE_KEY"] === "string" ? json["SUPABASE_PUBLISHABLE_KEY"] : undefined;
    cached = url && key ? { url, key } : null;
  } catch {
    cached = null;
  }
}
