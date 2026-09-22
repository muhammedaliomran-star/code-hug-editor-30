import { createFileRoute } from "@tanstack/react-router";
import PaymentsPage from "@/pages/Payments";
import { appRoute } from "@/lib/route-meta";

export const Route = createFileRoute("/payments")({
  ...appRoute({
    title: "سندات القبض والصرف",
    description: "إدارة سندات التحصيل والصرف ومتابعة حركة الدفعات.",
    path: "/payments",
  }),
  component: PaymentsPage,
});
