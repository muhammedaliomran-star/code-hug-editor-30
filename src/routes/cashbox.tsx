import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/lib/route-guards';
import CashboxPage from '@/pages/Cashbox';

export const Route = createFileRoute('/cashbox')({
  ssr: false,
  beforeLoad: requireAuth,
  component: CashboxPage,
});
