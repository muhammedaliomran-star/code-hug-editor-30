import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { ProductForm } from "@/components/ProductForm";
import { useDB } from "@/lib/store";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, PackagePlus } from "lucide-react";

export default function Page() {
  return (
    <AppShell>
      <PageTransition>
        <AddProductPage />
      </PageTransition>
    </AppShell>
  );
}

function AddProductPage() {
  const data = useDB();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        eyebrow="المنتجات"
        title="إضافة منتج جديد"
        subtitle="نفس الحقول الموجودة في النافذة السريعة، بمساحة أوسع للإدخال المتكرر."
        icon={<PackagePlus className="h-7 w-7" />}
        action={
          <Link
            to="/inventory"
            className="group island-btn bg-secondary text-secondary-foreground ring-1 ring-border"
          >
            <span className="ps-1">رجوع للمنتجات</span>
            <span className="island-btn-icon">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        }
      />

      <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col">
        <ProductForm
          existingBarcodes={data.stockItems.map((s) => s.barcode)}
          onSaved={() => navigate({ to: "/inventory" })}
          onCancel={() => navigate({ to: "/inventory" })}
          cancelLabel="إلغاء والرجوع"
        />
      </div>
    </>
  );
}
