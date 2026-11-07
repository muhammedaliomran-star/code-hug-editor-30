import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import Daily from "@/pages/Daily";
import { requireAuth } from "@/lib/route-guards";

const dailySearchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
  customerId: z.string().optional(),
  typeFilter: z.enum(["all", "installment", "cash"]).optional(),
  statusFilter: z.enum(["all", "paid", "partial", "unpaid"]).optional(),
  activeTab: z.enum(["invoices", "payments", "expenses", "returns"]).optional(),
  quickPreset: z.enum(["today", "yesterday", "this-week", "this-month"]).optional(),
});

export const Route = createFileRoute("/daily")({
  ssr: false,
  beforeLoad: requireAuth,
  validateSearch: dailySearchSchema,
  component: Daily,
  head: () => ({
    meta: [
      { title: "اليومية — سِجلّي" },
      { name: "description", content: "ملخص حركة اليوم: المبيعات والتحصيلات والمصروفات والصافي وملاحظات اليوم." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "اليومية — سِجلّي" },
      { property: "og:description", content: "ملخص حركة اليوم: المبيعات والتحصيلات والمصروفات والصافي وملاحظات اليوم." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/daily" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "اليومية — سِجلّي" },
      { name: "twitter:description", content: "ملخص حركة اليوم: المبيعات والتحصيلات والمصروفات والصافي وملاحظات اليوم." },
    ],
    links: [{ rel: "canonical", href: "/daily" }],
  }),
});