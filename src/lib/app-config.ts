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

/**
 * Bundled last-resort fallback. Same publishable values as
 * public/app-config.json (public by design — RLS is the real defense),
 * inlined into the JS bundle at build time so the app boots even when the
 * static host fails to serve /app-config.json. Keep the two files in sync;
 * the fetched copy wins when it loads, this one only fills the gap.
 */
import fallbackJson from "./app-config.fallback.json";

function readBundledFallback(): RuntimeAppConfig | null {
  try {
    const json = fallbackJson as Record<string, unknown>;
    const url = typeof json["SUPABASE_URL"] === "string" ? json["SUPABASE_URL"] : undefined;
    const key =
      typeof json["SUPABASE_PUBLISHABLE_KEY"] === "string" ? json["SUPABASE_PUBLISHABLE_KEY"] : undefined;
    return url && key ? { url, key } : null;
  } catch {
    return null;
  }
}

export function getBundledFallback(): RuntimeAppConfig | null {
  return readBundledFallback();
}

let cached: RuntimeAppConfig | null | undefined;

export function getRuntimeConfig(): RuntimeAppConfig | null {
  return cached ?? null;
}

/** Which source resolved the client credentials (for one-line diagnostics). */
export function describeEnvSource():
  | "build-env"
  | "runtime-config"
  | "bundled-fallback"
  | "process-env"
  | "missing" {
  if (typeof import.meta !== "undefined") {
    try {
      const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
      if (env?.["VITE_SUPABASE_URL"] && env?.["VITE_SUPABASE_PUBLISHABLE_KEY"]) return "build-env";
    } catch {
      // ignore
    }
  }
  if (cached?.url && cached?.key) return "runtime-config";
  if (readBundledFallback()) return "bundled-fallback";
  if (typeof process !== "undefined" && process.env?.["SUPABASE_URL"]) return "process-env";
  return "missing";
}

function configCandidates(): string[] {
  let base = "/";
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    if (typeof env?.["BASE_URL"] === "string" && env["BASE_URL"]) base = env["BASE_URL"];
  } catch {
    // ignore — fall back to root-absolute
  }
  if (!base.endsWith("/")) base += "/";
  const primary = `${base}app-config.json`;
  return primary === "/app-config.json" ? [primary] : [primary, "/app-config.json"];
}

export async function loadAppConfig(): Promise<void> {
  if (cached !== undefined) return;
  if (typeof window === "undefined") {
    cached = null;
    return;
  }
  // One retry: the very first navigation can race the service worker /
  // static host warm-up and fail transiently.
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const url of configCandidates()) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const json = (await res.json()) as Record<string, unknown>;
        const siteUrl = typeof json["SUPABASE_URL"] === "string" ? json["SUPABASE_URL"] : undefined;
        const key =
          typeof json["SUPABASE_PUBLISHABLE_KEY"] === "string" ? json["SUPABASE_PUBLISHABLE_KEY"] : undefined;
        if (siteUrl && key) {
          cached = { url: siteUrl, key };
          return;
        }
      } catch {
        // try next candidate / retry once
      }
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
  }
  cached = null;
}
