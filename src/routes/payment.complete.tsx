import { createFileRoute } from "@tanstack/react-router";
import PaymentComplete from "@/pages/PaymentComplete";

export const Route = createFileRoute("/payment/complete")({
  ssr: false,
  component: PaymentComplete,
  head: () => ({
    meta: [
      { title: "تأكيد الدفع — سِجلّي" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
