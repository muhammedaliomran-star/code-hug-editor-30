import { createFileRoute } from "@tanstack/react-router";
import BranchesPage from "@/pages/Branches";
import { appRoute } from "@/lib/route-meta";

export const Route = createFileRoute("/branches")({
  ...appRoute({
    title: "الفروع",
    description: "إدارة فروع المحل وبيانات كل فرع.",
    path: "/branches",
  }),
  component: BranchesPage,
});
