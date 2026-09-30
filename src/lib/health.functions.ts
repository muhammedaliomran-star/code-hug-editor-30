import { createServerFn } from "@tanstack/react-start";

/**
 * Deployment health probe — answers whether the server runtime has its
 * Supabase env wired. Intentionally has NO auth middleware and returns
 * booleans only (never secret values), so it works precisely when the
 * integration is broken — which is when it is needed.
 */
export const getDeploymentHealth = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  return {
    supabaseLinked: Boolean(url && key),
    checkedAt: new Date().toISOString(),
  };
});
