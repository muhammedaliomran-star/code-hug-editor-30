import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { PurchasesPage } from "@/pages/purchases/Purchases";

export const Route = createFileRoute("/purchases/")({
  ssr: false,
  beforeLoad: requireAuth,
  component: PurchasesPage,
});
