/**
 * Canonical public site URL — single source for absolute SEO URLs
 * (og:image, og:url, canonical, sitemap, JSON-LD).
 *
 * TODO: replace with the final production domain when it is known.
 * Can also be overridden at build time via VITE_SITE_URL.
 */
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL as string | undefined
)?.replace(/\/$/, "") || "https://code-hug-editor-30.lovable.app";

export const siteUrl = (path = "/") =>
  `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
