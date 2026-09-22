import { createFileRoute } from "@tanstack/react-router";
import { appRoute } from "@/lib/route-meta";
import { PurchasesPage } from "@/pages/purchases/Purchases";

export const Route = createFileRoute("/purchases/")({
  ...appRoute({
    title: "المشتريات",
    description: "فواتير الشراء من الموردين ومتابعة المدفوعات.",
    path: "/purchases",
  }),
  component: PurchasesPage,
});
