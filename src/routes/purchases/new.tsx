import { createFileRoute } from "@tanstack/react-router";
import { appRoute } from "@/lib/route-meta";
import { NewPurchasePage } from "@/pages/purchases/NewPurchase";

export const Route = createFileRoute("/purchases/new")({
  ...appRoute({
    title: "فاتورة شراء جديدة",
    description: "تسجيل فاتورة شراء جديدة من مورد.",
    path: "/purchases/new",
  }),
  component: NewPurchasePage,
});
