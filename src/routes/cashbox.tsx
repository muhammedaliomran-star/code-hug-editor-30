import { createFileRoute } from '@tanstack/react-router';
import { appRoute } from '@/lib/route-meta';
import CashboxPage from '@/pages/Cashbox';

export const Route = createFileRoute('/cashbox')({
  ...appRoute({
    title: "الصندوق والخزينة",
    description: "متابعة أرصدة الخزن والحركات والتحويلات الداخلية.",
    path: "/cashbox",
  }),
  component: CashboxPage,
});
