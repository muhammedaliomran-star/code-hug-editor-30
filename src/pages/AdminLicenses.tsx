import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { MetricCard } from "@/components/MetricCard";
import { StatTabs } from "@/components/StatTabs";
import { ActionButton } from "@/components/ActionButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Shield,
  KeyRound,
  Users,
  Sparkles,
  Search,
  Plus,
  FileSpreadsheet,
  Copy,
  BellRing,
  Wallet,
  Download,
  Store,
  DollarSign,
} from "lucide-react";
import { AdminLicenseCard } from "@/components/AdminLicenseCard";
import { CrmTab } from "@/components/licenses/CrmTab";
import { InstallmentsTab } from "@/components/licenses/InstallmentsTab";
import { BackupTab } from "@/components/licenses/BackupTab";
import { ManageLicenseDialog } from "@/components/licenses/ManageLicenseDialog";
import { RecordPaymentDialog } from "@/components/licenses/RecordPaymentDialog";
import { ChangePinDialog } from "@/components/licenses/ChangePinDialog";
import { LicenseSuccessView } from "@/components/licenses/LicenseSuccessView";
import { LicenseTierPicker } from "@/components/licenses/LicenseTierPicker";
import { LicenseHardwareRows } from "@/components/licenses/LicenseHardwareRows";
import { LicenseInstallmentFields } from "@/components/licenses/LicenseInstallmentFields";
import {
  getAdminLicenses,
  saveAdminLicenses,
  fetchLicensesFromCloud,
  pushLicensesToCloud,
  generateLicenseKey,
  verifySuperAdminPin,
  setSuperAdminPin,
  calculateDaysRemaining,
  generateLicenseWhatsAppMessage,
  printLicenseCertificate,
  printLicenseCommercialInvoice,
  exportLicensesToExcel,
  TIER_CONFIG,
  DEFAULT_MODULES,
  type LicenseRecord,
  type LicenseTier,
  type LicenseStatus,
  type ModulePermissions,
  type HardwareItem,
} from "@/lib/licensing";
import { toast } from "sonner";

export default function AdminLicensesPage() {
  const [pin, setPin] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [changePinOpen, setChangePinOpen] = useState(false);
  const [newPin, setNewPin] = useState("");

  const [licenses, setLicenses] = useState<LicenseRecord[]>(getAdminLicenses);
  const [activeTab, setActiveTab] = useState<"subscribers" | "crm" | "installments" | "backup">("subscribers");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");

  // Create License Dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<LicenseRecord | null>(null);

  // Form states for new license
  const [selectedTier, setSelectedTier] = useState<LicenseTier>("pro");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [paidAmount, setPaidAmount] = useState(String(TIER_CONFIG.pro.defaultPrice));
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly" | "lifetime">("yearly");
  const [customDays, setCustomDays] = useState(365);
  const [hardwareNotes, setHardwareNotes] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [taxRatePercent, setTaxRatePercent] = useState(14);

  // Hardware Items for Invoice
  const [hardwareItems, setHardwareItems] = useState<HardwareItem[]>([
    { id: "hw-1", name: "طابعة فواتير حرارية 80mm", quantity: 1, unitPrice: 2800 },
  ]);

  // Installment Plan options
  const [enableInstallments, setEnableInstallments] = useState(false);
  const [depositPaid, setDepositPaid] = useState(3000);
  const [installmentCount, setInstallmentCount] = useState(3);
  const [installmentMonthly, setInstallmentMonthly] = useState(1000);
  const [installmentNextDate, setInstallmentNextDate] = useState("");

  // Custom Permissions module
  const [customModules, setCustomModules] = useState<ModulePermissions>({ ...DEFAULT_MODULES.pro });

  // Detail / Edit / Manage Modal
  const [selectedLicense, setSelectedLicense] = useState<LicenseRecord | null>(null);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [newLogNote, setNewLogNote] = useState("");

  // Record Payment Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReceipt, setPaymentReceipt] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Pull licenses from cloud on mount
  useEffect(() => {
    fetchLicensesFromCloud().then(setLicenses);
  }, []);

  // Refresh data from storage + cloud
  const reloadData = async () => {
    const cloudLicenses = await fetchLicensesFromCloud();
    setLicenses(cloudLicenses);
  };

  // Save + push to cloud (fire-and-forget)
  const saveLicenses = (updated: LicenseRecord[]) => {
    setLicenses(updated);
    saveAdminLicenses(updated);
    pushLicensesToCloud(updated);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      toast.error("أدخل الرقم السري");
      return;
    }
    const valid = await verifySuperAdminPin(pin.trim());
    if (valid) {
      setIsAuthenticated(true);
      toast.success("مرحباً بك في لوحة تحكم السوبر أدمن وإدارة المنظومة");
    } else {
      toast.error("الرقم السري غير صحيح. يرجى المحاولة مجدداً.");
      setPin("");
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin.trim() || newPin.length < 4) {
      toast.error("يجب أن يتكون الرقم السري من 4 أرقام على الأقل");
      return;
    }
    try {
      await setSuperAdminPin(newPin.trim());
      toast.success("تم تحديث الرقم السري للمشرف العام بنجاح!");
      setChangePinOpen(false);
      setNewPin("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل تحديث الرقم السري. حاول مجدداً.");
    }
  };

  const handleTierChange = (tier: LicenseTier) => {
    setSelectedTier(tier);
    setPaidAmount(String(TIER_CONFIG[tier].defaultPrice));
    setCustomModules({ ...DEFAULT_MODULES[tier] });
    if (tier === "trial") {
      setBillingCycle("monthly");
      setCustomDays(14);
      setPaidAmount("0");
    } else if (tier === "starter") {
      setBillingCycle("monthly");
      setCustomDays(30);
    } else if (tier === "pro") {
      setBillingCycle("yearly");
      setCustomDays(365);
    } else if (tier === "enterprise") {
      setBillingCycle("lifetime");
      setCustomDays(9999);
    } else if (tier === "custom") {
      setBillingCycle("yearly");
      setCustomDays(365);
    }
  };

  // Add hardware item row
  const addHardwareRow = () => {
    setHardwareItems([
      ...hardwareItems,
      { id: `hw-${Date.now()}`, name: "", quantity: 1, unitPrice: 0 },
    ]);
  };

  const updateHardwareRow = (id: string, field: keyof HardwareItem, val: any) => {
    setHardwareItems(
      hardwareItems.map((h) => (h.id === id ? { ...h, [field]: val } : h))
    );
  };

  const removeHardwareRow = (id: string) => {
    setHardwareItems(hardwareItems.filter((h) => h.id !== id));
  };

  // Submit New License
  const handleCreateLicense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim() || !clientName.trim()) {
      toast.error("يرجى إدخال اسم المنشأة واسم العميل");
      return;
    }

    const key = generateLicenseKey(selectedTier);
    const now = new Date();
    const expiry =
      selectedTier === "enterprise" || billingCycle === "lifetime"
        ? "LIFETIME"
        : new Date(now.getTime() + customDays * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);

    const price = Number(paidAmount) || 0;
    const hwTotal = hardwareItems.reduce((a, b) => a + b.quantity * b.unitPrice, 0);
    const totalCommercial = price + hwTotal;

    const initialRecord: LicenseRecord = {
      id: `lic-${Date.now().toString().slice(-6)}`,
      key,
      tier: selectedTier,
      tierLabel: TIER_CONFIG[selectedTier].label,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim() || "—",
      shopName: shopName.trim(),
      shopAddress: shopAddress.trim() || undefined,
      taxNumber: taxNumber.trim() || undefined,
      issueDate: now.toISOString().slice(0, 10),
      expiryDate: expiry,
      status: selectedTier === "trial" ? "trial" : "active",
      paidAmount: price,
      currency: "ج.م",
      billingCycle: selectedTier === "enterprise" ? "lifetime" : billingCycle,
      notes: generalNotes.trim() || undefined,
      hardwareIncluded: hardwareNotes.trim() || undefined,
      hardwareItems: hardwareItems.filter((h) => h.name.trim()),
      taxRatePercent,
      modules: customModules,
      supportLogs: [
        {
          id: `log-${Date.now()}`,
          date: now.toISOString().slice(0, 10),
          author: "المشرف العام",
          action: "إنشاء ترخيص جديد",
          notes: `تم توليد ترخيص ${TIER_CONFIG[selectedTier].label} بقيمة ${price} ج.م`,
        },
      ],
      ...(enableInstallments && {
        installments: {
          totalPrice: totalCommercial,
          depositPaid: Number(depositPaid) || 0,
          remainingBalance: Math.max(0, totalCommercial - (Number(depositPaid) || 0)),
          installmentCount: Number(installmentCount) || 1,
          monthlyAmount: Number(installmentMonthly) || 0,
          nextDueDate:
            installmentNextDate ||
            new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          isCompleted: false,
          paymentsHistory: [
            {
              id: `p-${Date.now()}`,
              date: now.toISOString().slice(0, 10),
              amount: Number(depositPaid) || 0,
              receiptNumber: "REC-INIT-01",
              notes: "الدفعة المقدمة عند التعاقد",
            },
          ],
        },
      }),
    };

    const updated = [initialRecord, ...licenses];
    setLicenses(updated);
    saveLicenses(updated);
    setGeneratedResult(initialRecord);
    toast.success("تم إنشاء وتوثيق الترخيص بنجاح!");
  };

  // Add Support Log Note
  const handleAddSupportNote = () => {
    if (!selectedLicense || !newLogNote.trim()) return;
    const now = new Date().toISOString().slice(0, 10);
    const newLog = {
      id: `log-${Date.now()}`,
      date: now,
      author: "المشرف",
      action: "ملاحظة متابعة ودعم",
      notes: newLogNote.trim(),
    };

    const updatedLic: LicenseRecord = {
      ...selectedLicense,
      supportLogs: [newLog, ...(selectedLicense.supportLogs || [])],
    };

    const updatedAll = licenses.map((l) => (l.id === selectedLicense.id ? updatedLic : l));
    setLicenses(updatedAll);
    saveLicenses(updatedAll);
    setSelectedLicense(updatedLic);
    setNewLogNote("");
    toast.success("تمت إضافة الملاحظة لسجل العميل");
  };

  // Record Installment Payment
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLicense || !selectedLicense.installments) return;
    const amount = Number(paymentAmount) || 0;
    if (amount <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }

    const now = new Date().toISOString().slice(0, 10);
    const newRemaining = Math.max(0, selectedLicense.installments.remainingBalance - amount);
    const nextDue = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const paymentRecord = {
      id: `pay-${Date.now()}`,
      date: now,
      amount,
      receiptNumber: paymentReceipt.trim() || `REC-${Date.now().toString().slice(-4)}`,
      notes: paymentNotes.trim() || "سداد قسط دوري",
    };

    const updatedLic: LicenseRecord = {
      ...selectedLicense,
      installments: {
        ...selectedLicense.installments,
        remainingBalance: newRemaining,
        isCompleted: newRemaining === 0,
        nextDueDate: newRemaining === 0 ? undefined : nextDue,
        paymentsHistory: [paymentRecord, ...(selectedLicense.installments.paymentsHistory || [])],
      },
      supportLogs: [
        {
          id: `log-${Date.now()}`,
          date: now,
          author: "المشرف",
          action: "تحصيل قسط",
          notes: `تم تحصيل مبلغ ${amount} ج.م بإيصال (${paymentRecord.receiptNumber}) - المتبقي: ${newRemaining} ج.م`,
        },
        ...(selectedLicense.supportLogs || []),
      ],
    };

    const updatedAll = licenses.map((l) => (l.id === selectedLicense.id ? updatedLic : l));
    setLicenses(updatedAll);
    saveLicenses(updatedAll);
    setSelectedLicense(updatedLic);
    setPaymentModalOpen(false);
    setPaymentAmount("");
    setPaymentReceipt("");
    setPaymentNotes("");
    toast.success(`تم تسجيل تحصيل مبلغ ${amount} ج.م بنجاح!`);
  };

  // Update License Status or Extend
  const handleUpdateStatus = (licId: string, newStatus: LicenseStatus) => {
    const updated = licenses.map((l) => (l.id === licId ? { ...l, status: newStatus } : l));
    setLicenses(updated);
    saveLicenses(updated);
    if (selectedLicense?.id === licId) {
      setSelectedLicense({ ...selectedLicense, status: newStatus });
    }
    toast.success("تم تحديث حالة الترخيص بنجاح");
  };

  // Extend 1 Year
  const handleExtendOneYear = (lic: LicenseRecord) => {
    const baseDate =
      lic.expiryDate === "LIFETIME" || new Date(lic.expiryDate).getTime() < Date.now()
        ? new Date()
        : new Date(lic.expiryDate);
    const newExpiry = new Date(baseDate.getTime() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const now = new Date().toISOString().slice(0, 10);
    const updatedLic: LicenseRecord = {
      ...lic,
      expiryDate: newExpiry,
      status: "active",
      supportLogs: [
        {
          id: `log-${Date.now()}`,
          date: now,
          author: "المشرف",
          action: "تمديد ترخيص",
          notes: `تم تمديد صلاحية الترخيص لمدة سنة إضافية حتى ${newExpiry}`,
        },
        ...(lic.supportLogs || []),
      ],
    };

    const updated = licenses.map((l) => (l.id === lic.id ? updatedLic : l));
    setLicenses(updated);
    saveLicenses(updated);
    if (selectedLicense?.id === lic.id) setSelectedLicense(updatedLic);
    toast.success(`تم تمديد الاشتراك بنجاح حتى ${newExpiry}`);
  };

  // Delete License
  const handleToggleModule = (lic: LicenseRecord, key: string, value: boolean, label: string) => {
    const updatedLic: LicenseRecord = {
      ...lic,
      modules: { ...lic.modules, [key]: value },
    };
    const updatedAll = licenses.map((l) => (l.id === lic.id ? updatedLic : l));
    setLicenses(updatedAll);
    saveLicenses(updatedAll);
    setSelectedLicense(updatedLic);
    toast.success(`تم تحديث صلاحية (${label})`);
  };

  const handleDeleteLicense = (licId: string) => {
    if (confirm("هل أنت متأكد من حذف هذا الترخيص نهائياً من سجلات الإدارة؟")) {
      const updated = licenses.filter((l) => l.id !== licId);
      setLicenses(updated);
      saveLicenses(updated);
      setManageModalOpen(false);
      toast.success("تم حذف الترخيص");
    }
  };

  // Export JSON Backup
  const handleExportJsonBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(licenses, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `segilly_licenses_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("تم تنزيل النسخة الاحتياطية المشفرة لبيانات التراخيص");
  };

  // Import JSON Backup
  const handleImportJsonBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          setLicenses(parsed);
          saveLicenses(parsed);
          toast.success(`تم استيراد ${parsed.length} ترخيص بنجاح واستعادة قاعدة البيانات!`);
        } else {
          toast.error("ملف النسخة الاحتياطية غير صالح");
        }
      } catch (err) {
        toast.error("فشل قراءة الملف");
      }
    };
    reader.readAsText(file);
  };

  // Metrics Calculations
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalInstallmentDue = 0;
    let activeCount = 0;
    let trialCount = 0;
    let expiredCount = 0;
    let warningCount = 0;

    licenses.forEach((l) => {
      totalRevenue += l.paidAmount || 0;
      if (l.installments) {
        totalInstallmentDue += l.installments.remainingBalance || 0;
      }
      if (l.status === "active") activeCount++;
      if (l.status === "trial") trialCount++;
      if (l.status === "expired") expiredCount++;

      const rem = calculateDaysRemaining(l.expiryDate);
      if (rem.isWarning || rem.isExpired || rem.isTrialExpiring) {
        warningCount++;
      }
    });

    return {
      totalRevenue,
      totalInstallmentDue,
      activeCount,
      trialCount,
      expiredCount,
      warningCount,
      totalCount: licenses.length,
    };
  }, [licenses]);

  // Filtered Licenses
  const filteredLicenses = useMemo(() => {
    return licenses.filter((l) => {
      const matchSearch =
        search === "" ||
        l.clientName.toLowerCase().includes(search.toLowerCase()) ||
        l.shopName.toLowerCase().includes(search.toLowerCase()) ||
        l.clientPhone.includes(search) ||
        l.key.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      const matchTier = tierFilter === "all" || l.tier === tierFilter;

      return matchSearch && matchStatus && matchTier;
    });
  }, [licenses, search, statusFilter, tierFilter]);

  // CRM: Expiring & Follow-up list
  const crmList = useMemo(() => {
    return licenses
      .map((l) => {
        const rem = calculateDaysRemaining(l.expiryDate);
        return {
          ...l,
          daysRemaining: rem.days,
          isExpired: rem.isExpired,
          isWarning: rem.isWarning,
          isTrialExpiring: rem.isTrialExpiring,
        };
      })
      .filter((l) => l.isExpired || l.isWarning || l.isTrialExpiring || l.tier === "trial")
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [licenses]);

  // Installments list
  const installmentsList = useMemo(() => {
    return licenses.filter((l) => l.installments && l.installments.remainingBalance > 0);
  }, [licenses]);

  // Copy Key
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم نسخ المفتاح للحافظة!");
  };

  // WhatsApp Sender
  const openWhatsApp = (phone: string, message: string) => {
    const clean = phone.replace(/[^0-9]/g, "");
    const formatted = clean.startsWith("01") ? `2${clean}` : clean;
    const url = `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // If Not Authenticated, show Login Screen
  if (!isAuthenticated) {
    return (
      <AppShell>
        <PageTransition>
          <div className="min-h-[75vh] flex items-center justify-center p-4">
            <div className="w-full max-w-md p-8 rounded-3xl bg-foreground/[0.02] border border-foreground/10 text-center space-y-6 shadow-2xl backdrop-blur-xl">
              <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20 shadow-inner">
                <Shield className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-xl font-black text-foreground">لوحة تحكم السوبر أدمن والتراخيص</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  خاصة بالمشرف العام لإدارة المشتركين، الفواتير، ومفاتيح التفعيل
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4 text-right">
                <div>
                  <Label className="text-xs font-bold text-muted-foreground">أدخل الرقم السري للمشرف (PIN)</Label>
                  <div className="relative mt-1.5">
                    <Input
                      type="password"
                      autoFocus
                      placeholder="••••"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="h-12 text-center text-xl font-bold tracking-widest rounded-2xl bg-background"
                      maxLength={8}
                    />
                    <KeyRound className="w-4 h-4 text-muted-foreground absolute left-4 top-4" />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    أدخل الرقم السري للمشرف العام
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 rounded-2xl font-black text-sm bg-primary text-black hover:bg-primary/90 shadow-lg shadow-primary/20"
                >
                  تسجيل الدخول للمنظومة
                </Button>
              </form>
            </div>
          </div>
        </PageTransition>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTransition>
        <div className="space-y-6 text-right max-w-7xl mx-auto pb-12">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-foreground/5">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                  <Shield className="w-6 h-6" />
                </span>
                <h1 className="text-2xl font-black text-foreground">لوحة المشرف العام — التراخيص والمشتركين</h1>
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Super Admin</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                توليد التراخيص التجارية، إصدار الفواتير وعروض الأسعار، إدارة الأقساط، ومتابعة تجديدات العملاء.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                tone="surface"
                onClick={() => setChangePinOpen(true)}
                icon={<KeyRound className="h-4 w-4" />}
              >
                تغيير PIN المشرف
              </ActionButton>

              <ActionButton
                onClick={() => {
                  setGeneratedResult(null);
                  setShopName("");
                  setClientName("");
                  setClientPhone("");
                  setShopAddress("");
                  setTaxNumber("");
                  setGeneralNotes("");
                  setHardwareNotes("");
                  setEnableInstallments(false);
                  setCreateOpen(true);
                }}
                icon={<Plus className="h-4 w-4" />}
              >
                إصدار ترخيص / عميل جديد
              </ActionButton>
            </div>
          </div>

          {/* Top KPI Metrics Cards */}
          <div className="grid auto-rows-fr grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
            className="h-full"
              icon={DollarSign}
              label="إجمالي مبيعات التراخيص"
              value={stats.totalRevenue}
              format={(n) => `${Math.round(n).toLocaleString()} ج.م`}
              sub={`من ${stats.totalCount} ترخيص صادر`}
            />
            <MetricCard
            className="h-full"
              icon={Wallet}
              label="المتبقي بأقساط البرامج"
              value={stats.totalInstallmentDue}
              format={(n) => `${Math.round(n).toLocaleString()} ج.م`}
              sub="أقساط مجدولة للتحصيل"
            />
            <MetricCard
            className="h-full"
              icon={Users}
              label="المشتركين السارين"
              value={stats.activeCount}
              format={(n) => `${Math.round(n)} نشط`}
              sub={`بالإضافة إلى ${stats.trialCount} تجريبي`}
            />

            <MetricCard
            className="h-full"
              icon={BellRing}
              label="تنبيهات التجديد والمتابعة"
              value={stats.warningCount}
              tone={stats.warningCount > 0 ? "danger" : "neutral"}
              format={(n) => `${Math.round(n)} عميل`}
              sub="منتهي أو قارب على الانتهاء"
            />
          </div>

          {/* Main Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
            <StatTabs
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { value: "subscribers", label: "سجل المشتركين والتراخيص", count: licenses.length, icon: <Store className="w-4 h-4" /> },
                { value: "crm", label: "مركز التجديدات والمتابعات CRM", count: crmList.length, icon: <BellRing className="w-4 h-4 text-amber-500" /> },
                { value: "installments", label: "أقساط البرامج والأجهزة", count: installmentsList.length, icon: <Wallet className="w-4 h-4 text-emerald-500" /> },
                { value: "backup", label: "النسخ الاحتياطي والمزامنة", icon: <Download className="w-4 h-4 text-primary" /> },
              ]}
            />

            {/* TAB 1: ALL SUBSCRIBERS */}
            <TabsContent value="subscribers" className="space-y-4">
              {/* Search and Filters Bar */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-4 rounded-3xl bg-foreground/[0.02] border border-foreground/10">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
                  <Input
                    placeholder="ابحث بالاسم، المحل، الهاتف، أو المفتاح..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-10 pr-9 rounded-2xl text-xs bg-background"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10 rounded-2xl text-xs w-32 bg-background">
                      <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الحالات</SelectItem>
                      <SelectItem value="active">ساري</SelectItem>
                      <SelectItem value="trial">تجريبي</SelectItem>
                      <SelectItem value="expired">منتهي</SelectItem>
                      <SelectItem value="suspended">موقوف</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={tierFilter} onValueChange={setTierFilter}>
                    <SelectTrigger className="h-10 rounded-2xl text-xs w-36 bg-background">
                      <SelectValue placeholder="الباقة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الباقات</SelectItem>
                      <SelectItem value="trial">تجريبية</SelectItem>
                      <SelectItem value="starter">أساسية</SelectItem>
                      <SelectItem value="pro">برو</SelectItem>
                      <SelectItem value="enterprise">مؤسسية</SelectItem>
                      <SelectItem value="custom">مخصصة</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportLicensesToExcel(filteredLicenses)}
                    className="h-10 rounded-2xl text-xs font-bold gap-1.5"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    تصدير إكسيل
                  </Button>
                </div>
              </div>

              {/* Licenses Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredLicenses.map((lic) => (
                  <AdminLicenseCard
                    key={lic.id}
                    license={lic}
                    onManage={(l) => {
                      setSelectedLicense(l);
                      setManageModalOpen(true);
                    }}
                    onExtend={handleExtendOneYear}
                    onDelete={(l) => handleDeleteLicense(l.id)}
                    onWhatsApp={openWhatsApp}
                    onCopy={copyToClipboard}
                  />
                ))}
              </div>
            </TabsContent>

            {/* TAB 2: CRM & RENEWALS */}
            <CrmTab
              items={crmList}
              onWhatsApp={openWhatsApp}
              onExtend={handleExtendOneYear}
              onManage={(l) => {
                setSelectedLicense(l);
                setManageModalOpen(true);
              }}
            />

            {/* TAB 3: INSTALLMENTS MANAGEMENT */}
            <InstallmentsTab
              items={installmentsList}
              onRecordPayment={(l) => {
                setSelectedLicense(l);
                setPaymentModalOpen(true);
              }}
              onWhatsApp={openWhatsApp}
            />

            {/* TAB 4: BACKUP & DATA HUB */}
            <BackupTab onExportJson={handleExportJsonBackup} onImportJson={handleImportJsonBackup} />
          </Tabs>

          {/* ========================================================================= */}
          {/* MODAL 1: CREATE NEW LICENSE / CLIENT */}
          {/* ========================================================================= */}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto text-right rounded-3xl p-6">
              <DialogHeader className="text-right pb-3 border-b border-foreground/10">
                <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  إصدار ترخيص وتوثيق عميل جديد
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  أدخل بيانات المنشأة، الباقة المطلوبة، الأجهزة الموردة، وخطة السداد.
                </DialogDescription>
              </DialogHeader>

              {generatedResult ? (
                /* Success View After Generation */
                <LicenseSuccessView
                  result={generatedResult}
                  onCopy={copyToClipboard}
                  onPrintCertificate={printLicenseCertificate}
                  onPrintInvoice={(l) => printLicenseCommercialInvoice(l, "invoice")}
                  onSendWhatsApp={(l) => openWhatsApp(l.clientPhone, generateLicenseWhatsAppMessage(l))}
                  onClose={() => setCreateOpen(false)}
                />
              ) : (
                /* Form View */
                <form onSubmit={handleCreateLicense} className="space-y-6 py-2">
                  {/* Step 1: Tier Selection */}
                  <LicenseTierPicker selected={selectedTier} onSelect={handleTierChange} />

                  {/* Step 2: Client & Shop Info */}
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-muted-foreground">2. بيانات العميل والمنشأة:</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">اسم المحل / النشاط التجاري *</Label>
                        <Input
                          required
                          placeholder="مثال: سوبر ماركت الفيروز"
                          value={shopName}
                          onChange={(e) => setShopName(e.target.value)}
                          className="h-10 rounded-2xl text-xs mt-1 bg-background"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground">اسم العميل المسؤول *</Label>
                        <Input
                          required
                          placeholder="مثال: أ. إبراهيم محمد"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          className="h-10 rounded-2xl text-xs mt-1 bg-background"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground">رقم هاتف واتساب *</Label>
                        <Input
                          required
                          placeholder="مثال: 01012345678"
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          className="h-10 rounded-2xl text-xs mt-1 bg-background"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground">عنوان المتجر / المدينة</Label>
                        <Input
                          placeholder="مثال: القاهرة، التجمع الخامس"
                          value={shopAddress}
                          onChange={(e) => setShopAddress(e.target.value)}
                          className="h-10 rounded-2xl text-xs mt-1 bg-background"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Pricing & Duration */}
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-muted-foreground">3. التسعير وفترة الصلاحية:</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">سعر بيع الترخيص (ج.م)</Label>
                        <Input
                          type="number"
                          value={paidAmount}
                          onChange={(e) => setPaidAmount(e.target.value)}
                          className="h-10 rounded-2xl text-xs mt-1 bg-background"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground">نوع الاشتراك</Label>
                        <Select
                          value={billingCycle}
                          onValueChange={(v: any) => {
                            setBillingCycle(v);
                            if (v === "monthly") setCustomDays(30);
                            if (v === "yearly") setCustomDays(365);
                            if (v === "lifetime") setCustomDays(9999);
                          }}
                        >
                          <SelectTrigger className="h-10 rounded-2xl text-xs mt-1 bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">شهري متجدد</SelectItem>
                            <SelectItem value="yearly">سنوي</SelectItem>
                            <SelectItem value="lifetime">مدى الحياة (دائم)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground">مدة الترخيص (أيام)</Label>
                        <Input
                          type="number"
                          disabled={billingCycle === "lifetime"}
                          value={customDays}
                          onChange={(e) => setCustomDays(Number(e.target.value))}
                          className="h-10 rounded-2xl text-xs mt-1 bg-background"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Step 4: Hardware and Equipment Items (For Invoicing) */}
                  <LicenseHardwareRows
                    items={hardwareItems}
                    onAdd={addHardwareRow}
                    onUpdate={updateHardwareRow}
                    onRemove={removeHardwareRow}
                  />

                  {/* Step 5: Installments Plan Option */}
                  <LicenseInstallmentFields
                    enabled={enableInstallments}
                    onEnabledChange={setEnableInstallments}
                    deposit={depositPaid}
                    onDepositChange={setDepositPaid}
                    count={installmentCount}
                    onCountChange={setInstallmentCount}
                    monthly={installmentMonthly}
                    onMonthlyChange={setInstallmentMonthly}
                  />

                  <DialogFooter className="pt-3 border-t border-foreground/10 flex items-center justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setCreateOpen(false)}
                      className="rounded-2xl h-11 text-xs"
                    >
                      إلغاء
                    </Button>
                    <Button
                      type="submit"
                      className="rounded-2xl h-11 px-8 font-black text-xs bg-primary text-black hover:bg-primary/90"
                    >
                      إنشاء وتوليد المفتاح الآن
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>

          {/* ========================================================================= */}
          {/* MODAL 2: MANAGE LICENSE DETAILS, PERMISSIONS & SUPPORT LOGS */}
          {/* ========================================================================= */}
          <ManageLicenseDialog
            open={manageModalOpen}
            onOpenChange={setManageModalOpen}
            license={selectedLicense}
            onCopy={copyToClipboard}
            onExtend={handleExtendOneYear}
            onPrintCertificate={printLicenseCertificate}
            onPrintInvoice={(l) => printLicenseCommercialInvoice(l, "invoice")}
            onToggleModule={handleToggleModule}
            logNote={newLogNote}
            onLogNoteChange={setNewLogNote}
            onAddLog={handleAddSupportNote}
            onDelete={handleDeleteLicense}
          />

          {/* ========================================================================= */}
          {/* MODAL 3: RECORD INSTALLMENT PAYMENT */}
          {/* ========================================================================= */}
          <RecordPaymentDialog
            open={paymentModalOpen}
            onOpenChange={setPaymentModalOpen}
            license={selectedLicense}
            onSubmit={handleRecordPayment}
            amount={paymentAmount}
            onAmountChange={setPaymentAmount}
            receipt={paymentReceipt}
            onReceiptChange={setPaymentReceipt}
            notes={paymentNotes}
            onNotesChange={setPaymentNotes}
          />

          {/* ========================================================================= */}
          {/* MODAL 4: CHANGE SUPER ADMIN PIN */}
          {/* ========================================================================= */}
          <ChangePinDialog
            open={changePinOpen}
            onOpenChange={setChangePinOpen}
            pin={newPin}
            onPinChange={setNewPin}
            onSubmit={handleChangePin}
          />
        </div>
      </PageTransition>
    </AppShell>
  );
}
