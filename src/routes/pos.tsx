import { createFileRoute } from "@tanstack/react-router";
import PosPage from "@/pages/Pos";
import { appRoute } from "@/lib/route-meta";

export const Route = createFileRoute("/pos")({
  ...appRoute({
    title: "نقطة البيع السريعة (POS)",
    description: "شاشة كاشير سريعة لإصدار فواتير البيع النقدي وإدارة السلات المعلقة وطباعة البونات.",
    path: "/pos",
  }),
  component: PosPage,
});
