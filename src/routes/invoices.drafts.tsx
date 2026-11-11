import { createFileRoute } from "@tanstack/react-router";
import SalesDrafts from "@/pages/SalesDrafts";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/invoices/drafts")({
  ssr: false,
  beforeLoad: requireAuth,
  component: SalesDrafts,
  head: () => ({
    meta: [
      { title: "مسودات فواتير البيع — سِجلّي" },
      { name: "description", content: "إدارة مسودات فواتير البيع والحجوزات المؤقتة والعربون." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
