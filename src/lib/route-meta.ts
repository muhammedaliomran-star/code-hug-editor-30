import { requireAuth } from "@/lib/route-guards";

/**
 * Unified template for authenticated app routes (#16).
 *
 * Every app page gets: no-SSR, requireAuth gate, and a complete head
 * (title + description + noindex robots + OpenGraph + Twitter + canonical).
 * Public/marketing routes (landing, auth, legal, kiosks) keep custom heads.
 */
export function appRoute(options: { title: string; description: string; path: string }) {
  const pageTitle = `${options.title} — سِجلّي`;
  return {
    ssr: false as const,
    beforeLoad: requireAuth,
    head: () => ({
      meta: [
        { title: pageTitle },
        { name: "description", content: options.description },
        { name: "robots", content: "noindex, nofollow" },
        { property: "og:title", content: pageTitle },
        { property: "og:description", content: options.description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: options.path },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: pageTitle },
        { name: "twitter:description", content: options.description },
      ],
      links: [{ rel: "canonical", href: options.path }],
    }),
  };
}
