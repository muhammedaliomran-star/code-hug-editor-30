import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { NewPurchasePage } from "@/pages/purchases/NewPurchase";

export const Route = createFileRoute("/purchases/new")({
  ssr: false,
  beforeLoad: requireAuth,
  component: NewPurchasePage,
});
