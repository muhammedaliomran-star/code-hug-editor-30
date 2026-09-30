import { createFileRoute } from "@tanstack/react-router";
import Landing from "@/pages/Landing";
import { siteUrl } from "@/lib/site";

const OG_IMAGE = siteUrl("/og-segilly.jpg");

export const Route = createFileRoute("/landing")({
  // NOTE: SSR stays ON for /landing (unlike app routes) so search engines
  // and AI crawlers that don't execute JS still see the full content.
  component: Landing,
  head: () => ({
    meta: [
      { title: "سِجلّي — إدارة فواتير وأقساط المحلات" },
      {
        name: "description",
        content:
          "نظام عربي لإدارة العملاء والفواتير والأقساط والمخزون والمصروفات لمحلات البيع بالتقسيط في مصر.",
      },
      { property: "og:title", content: "سِجلّي — إدارة فواتير وأقساط المحلات" },
      {
        property: "og:description",
        content:
          "من الفاتورة لآخر قسط — عملاء ومخزون ومصروفات، محسوبة بالمليم.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl("/landing") },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "640" },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:locale", content: "ar_EG" },
      { name: "twitter:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "سِجلّي — إدارة فواتير وأقساط المحلات" },
      {
        name: "twitter:description",
        content:
          "من الفاتورة لآخر قسط — عملاء ومخزون ومصروفات، محسوبة بالمليم.",
      },
    ],
    links: [
      { rel: "canonical", href: siteUrl("/landing") },
      { rel: "alternate", hrefLang: "ar", href: siteUrl("/landing") },
      { rel: "alternate", hrefLang: "x-default", href: siteUrl("/landing") },
    ],
  }),
});
