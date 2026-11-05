import { createContext, useContext, useState, useMemo, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import {
  useDB,
  Branch,
  fmt,
  StockItem,
  useShopSettings,
} from "@/lib/store";
import {
  calculateBranchStockValuation,
  getBranchStockList,
  getProductStockInBranch,
  setBranchStockAbsolute,
  getBranchTransfers,
  createBranchTransfer,
  dispatchBranchTransfer,
  receiveBranchTransfer,
  cancelBranchTransfer,
  printBranchTransferNote,
  calculateBranchCashboxSummary,
  getBranchRemittances,
  addBranchRemittance,
  getBranchShifts,
  closeBranchShift,
  printBranchShiftZReport,
  calculateBranchProfitability,
  getBranchStaff,
  addBranchStaffMember,
  updateBranchStaffMember,
  removeBranchStaffMember,
  getActiveBranchId,
  setActiveBranchId,
  BranchTransfer,
  BranchTransferItem,
  BranchStaffMember,
  getExpensesForBranch,
  linkExpenseToBranch,
  saveBranchProfile,
  getBranchProfile,
  type BranchProfile,
} from "@/lib/branch-system";

export interface BranchesContextValue {
  // DB data
  branches: Branch[];
  addBranch: (...args: any[]) => Promise<any>;
  updateBranch: (...args: any[]) => Promise<void>;
  removeBranch: (id: string) => void;
  stockItems: StockItem[];
  invoices: any[];
  expenses: any[];
  payments: any[];
  loading: boolean;
  shopSettings: any;
  cur: string;

  // Navigation
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  activeBranch: Branch | undefined;

  // Computed
  totalValuation: { cost: number; retail: number };

  // Branch CRUD
  isBranchDialogOpen: boolean;
  setIsBranchDialogOpen: (open: boolean) => void;
  editingBranch: Branch | null;
  setEditingBranch: (branch: Branch | null) => void;
  editingBranchProfile: BranchProfile;
  handleSaveBranch: (e: React.FormEvent<HTMLFormElement>) => void;

  // Transfer state
  transfers: BranchTransfer[];
  isCreateTransferOpen: boolean;
  setIsCreateTransferOpen: (open: boolean) => void;
  transferFrom: string;
  setTransferFrom: (id: string) => void;
  transferTo: string;
  setTransferTo: (id: string) => void;
  transferDriver: string;
  setTransferDriver: (name: string) => void;
  transferNotes: string;
  setTransferNotes: (notes: string) => void;
  transferItems: BranchTransferItem[];
  setTransferItems: React.Dispatch<React.SetStateAction<BranchTransferItem[]>>;
  inspectTransfer: BranchTransfer | null;
  setInspectTransfer: (t: BranchTransfer | null) => void;
  receiveModalOpen: boolean;
  setReceiveModalOpen: (open: boolean) => void;
  receiveTargetTransfer: BranchTransfer | null;
  setReceiveTargetTransfer: (t: BranchTransfer | null) => void;
  receivedItemInputs: Record<string, { receivedQty: number; damagedQty: number; notes: string }>;
  setReceivedItemInputs: React.Dispatch<React.SetStateAction<Record<string, { receivedQty: number; damagedQty: number; notes: string }>>>;
  handleAddTransferItem: (stockItem: StockItem) => void;
  handleCreateTransferSubmit: () => void;
  handleDispatch: (id: string) => void;
  handleOpenReceive: (t: BranchTransfer) => void;
  handleConfirmReceive: () => void;
  handleCancelTransfer: (id: string) => void;

  // Cashbox / Remittance / Shift state
  remittances: any[];
  shifts: any[];
  isRemittanceOpen: boolean;
  setIsRemittanceOpen: (open: boolean) => void;
  isZReportOpen: boolean;
  setIsZReportOpen: (open: boolean) => void;
  remittanceAmount: string;
  setRemittanceAmount: (val: string) => void;
  remittanceDest: "main_vault" | "bank";
  setRemittanceDest: (val: "main_vault" | "bank") => void;
  remittanceDestName: string;
  setRemittanceDestName: (val: string) => void;
  remittanceRef: string;
  setRemittanceRef: (val: string) => void;
  remittanceNotes: string;
  setRemittanceNotes: (val: string) => void;
  zOpeningCash: string;
  setZOpeningCash: (val: string) => void;
  zActualCash: string;
  setZActualCash: (val: string) => void;
  zCashierName: string;
  setZCashierName: (val: string) => void;
  zVarianceReason: string;
  setZVarianceReason: (val: string) => void;
  handleAddRemittanceSubmit: (e: React.FormEvent) => void;
  handleCloseShiftSubmit: (e: React.FormEvent) => void;

  // Staff state
  staffList: BranchStaffMember[];
  isStaffDialogOpen: boolean;
  setIsStaffDialogOpen: (open: boolean) => void;
  editingStaff: BranchStaffMember | null;
  setEditingStaff: (staff: BranchStaffMember | null) => void;
  roleSimulatorBranch: string;
  setRoleSimulatorBranch: (val: string) => void;
  handleSaveStaff: (e: React.FormEvent<HTMLFormElement>) => void;

  // Stock inventory filter
  stockSearch: string;
  setStockSearch: (val: string) => void;
  stockFilterLow: boolean;
  setStockFilterLow: (val: boolean) => void;

  // Refresh
  refreshBranchData: () => void;
}

const BranchesContext = createContext<BranchesContextValue | null>(null);

export function useBranches() {
  const ctx = useContext(BranchesContext);
  if (!ctx) throw new Error("useBranches must be used within BranchesProvider");
  return ctx;
}

export function BranchesProvider({ children }: { children: ReactNode }) {
  const {
    branches,
    addBranch,
    updateBranch,
    removeBranch,
    stockItems,
    invoices,
    expenses,
    payments,
    loading,
  } = useDB();
  const { settings: shopSettings } = useShopSettings();
  const cur = shopSettings.currency || "ج.م";

  const [activeTab, setActiveTab] = useState("branches");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");

  useEffect(() => {
    const active = getActiveBranchId();
    if (active !== "all") {
      setSelectedBranchId(active);
    } else if (branches.length > 0) {
      const main = branches.find((b) => b.isMain) || branches[0];
      setSelectedBranchId(main.id);
    }
  }, [branches]);

  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const editingBranchProfile = editingBranch ? getBranchProfile(editingBranch.id) : {};

  const [transfers, setTransfers] = useState<BranchTransfer[]>(getBranchTransfers());
  const [isCreateTransferOpen, setIsCreateTransferOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferDriver, setTransferDriver] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferItems, setTransferItems] = useState<BranchTransferItem[]>([]);
  const [inspectTransfer, setInspectTransfer] = useState<BranchTransfer | null>(null);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receiveTargetTransfer, setReceiveTargetTransfer] = useState<BranchTransfer | null>(null);
  const [receivedItemInputs, setReceivedItemInputs] = useState<
    Record<string, { receivedQty: number; damagedQty: number; notes: string }>
  >({});

  const [remittances, setRemittances] = useState(getBranchRemittances());
  const [shifts, setShifts] = useState(getBranchShifts());
  const [isRemittanceOpen, setIsRemittanceOpen] = useState(false);
  const [isZReportOpen, setIsZReportOpen] = useState(false);
  const [remittanceAmount, setRemittanceAmount] = useState("");
  const [remittanceDest, setRemittanceDest] = useState<"main_vault" | "bank">("main_vault");
  const [remittanceDestName, setRemittanceDestName] = useState("الخزينة المركزية");
  const [remittanceRef, setRemittanceRef] = useState("");
  const [remittanceNotes, setRemittanceNotes] = useState("");
  const [zOpeningCash, setZOpeningCash] = useState("500");
  const [zActualCash, setZActualCash] = useState("");
  const [zCashierName, setZCashierName] = useState("كاشير الفرع");
  const [zVarianceReason, setZVarianceReason] = useState("");

  const [staffList, setStaffList] = useState<BranchStaffMember[]>(getBranchStaff());
  const [isStaffDialogOpen, setIsStaffDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<BranchStaffMember | null>(null);
  const [roleSimulatorBranch, setRoleSimulatorBranch] = useState<string>("all");

  const [stockSearch, setStockSearch] = useState("");
  const [stockFilterLow, setStockFilterLow] = useState(false);

  const refreshBranchData = () => {
    setTransfers(getBranchTransfers());
    setRemittances(getBranchRemittances());
    setShifts(getBranchShifts());
    setStaffList(getBranchStaff());
  };

  useEffect(() => {
    const listener = () => refreshBranchData();
    window.addEventListener("segilly_branch_data_updated", listener);
    return () => window.removeEventListener("segilly_branch_data_updated", listener);
  }, []);

  const activeBranch = useMemo(() => {
    return branches.find((b) => b.id === selectedBranchId) || branches[0];
  }, [branches, selectedBranchId]);

  const totalValuation = useMemo(() => {
    let cost = 0;
    let retail = 0;
    branches.forEach((b) => {
      const v = calculateBranchStockValuation(b.id, stockItems);
      cost += v.totalCostValue;
      retail += v.totalRetailValue;
    });
    return { cost, retail };
  }, [branches, stockItems]);

  const handleSaveBranch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      location: formData.get("location") as string,
      phone: formData.get("phone") as string,
      managerName: formData.get("managerName") as string,
      isMain: formData.get("isMain") === "on",
    };
    const profilePatch = {
      code: (formData.get("branchCode") as string) || "",
      taxNumber: (formData.get("taxNumber") as string) || "",
      commercialRecord: (formData.get("commercialRecord") as string) || "",
      email: (formData.get("branchEmail") as string) || "",
    };

    try {
      if (editingBranch) {
        await updateBranch(editingBranch.id, data);
        saveBranchProfile(editingBranch.id, profilePatch);
        toast.success("تم تحديث بيانات الفرع بنجاح");
      } else {
        const created = await addBranch(data);
        const newId = (created as any)?.id;
        if (newId) saveBranchProfile(newId, profilePatch);
        toast.success("تمت إضافة الفرع الجديد بنجاح");
      }
      setIsBranchDialogOpen(false);
      setEditingBranch(null);
    } catch {
      toast.error("حدث خطأ أثناء حفظ الفرع");
    }
  };

  const handleAddTransferItem = (stockItem: StockItem) => {
    const existing = transferItems.find((i) => i.stockItemId === stockItem.id);
    if (existing) {
      setTransferItems((prev) =>
        prev.map((i) =>
          i.stockItemId === stockItem.id ? { ...i, requestedQty: i.requestedQty + 1, sentQty: i.sentQty + 1 } : i
        )
      );
    } else {
      setTransferItems((prev) => [
        ...prev,
        {
          stockItemId: stockItem.id,
          name: stockItem.name,
          barcode: stockItem.barcode,
          requestedQty: 1,
          sentQty: 1,
          receivedQty: 0,
          damagedQty: 0,
          unitCost: stockItem.lastUnitCost || 0,
          salePrice: stockItem.salePrice || 0,
        },
      ]);
    }
    toast.success(`تمت إضافة ${stockItem.name} لأمر التحويل`);
  };

  const handleCreateTransferSubmit = () => {
    if (!transferFrom || !transferTo) {
      toast.error("يرجى اختيار فرع المصدر وفرع الوجهة");
      return;
    }
    if (transferFrom === transferTo) {
      toast.error("لا يمكن التحويل لنفس الفرع!");
      return;
    }
    if (transferItems.length === 0) {
      toast.error("يرجى إضافة صنف واحد على الأقل للتحويل");
      return;
    }

    createBranchTransfer({
      fromBranchId: transferFrom,
      toBranchId: transferTo,
      items: transferItems,
      notes: transferNotes,
      driverName: transferDriver,
      createdBy: "المدير العام",
    });

    toast.success("تم إنشاء أمر التحويل كمسودة بنجاح");
    setIsCreateTransferOpen(false);
    setTransferItems([]);
    setTransferNotes("");
    setTransferDriver("");
    refreshBranchData();
  };

  const handleDispatch = (id: string) => {
    const ok = dispatchBranchTransfer(id, "أمين مخزن الإرسال");
    if (ok) {
      toast.success("تم إرسال الشحنة وخصم الكميات من فرع المصدر بنجاح");
      refreshBranchData();
    } else {
      toast.error("تعذر إرسال الشحنة");
    }
  };

  const handleOpenReceive = (t: BranchTransfer) => {
    setReceiveTargetTransfer(t);
    const inputs: Record<string, { receivedQty: number; damagedQty: number; notes: string }> = {};
    t.items.forEach((item) => {
      inputs[item.stockItemId] = {
        receivedQty: item.sentQty,
        damagedQty: 0,
        notes: "",
      };
    });
    setReceivedItemInputs(inputs);
    setReceiveModalOpen(true);
  };

  const handleConfirmReceive = () => {
    if (!receiveTargetTransfer) return;
    const receivedList = Object.entries(receivedItemInputs).map(([stockItemId, val]: [string, { receivedQty: number; damagedQty: number; notes: string }]) => ({
      stockItemId,
      receivedQty: val.receivedQty,
      damagedQty: val.damagedQty,
      notes: val.notes,
    }));

    const ok = receiveBranchTransfer({
      transferId: receiveTargetTransfer.id,
      receivedItems: receivedList,
      receivedBy: "أمين مخزن الاستلام",
    });

    if (ok) {
      toast.success("تم استلام الشحنة وإيداع البضاعة بمخزون الفرع بنجاح");
      setReceiveModalOpen(false);
      refreshBranchData();
    } else {
      toast.error("فشل تأكيد الاستلام");
    }
  };

  const handleCancelTransfer = (id: string) => {
    if (confirm("هل أنت متأكد من إلغاء أمر التحويل؟ سيتم إرجاع أي كميات مخصومة لفرع المصدر.")) {
      cancelBranchTransfer(id);
      toast.success("تم إلغاء أمر التحويل");
      refreshBranchData();
    }
  };

  const handleAddRemittanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(remittanceAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }
    if (!activeBranch) return;

    addBranchRemittance({
      branchId: activeBranch.id,
      amount: amt,
      destinationType: remittanceDest,
      destinationName: remittanceDestName,
      referenceNumber: remittanceRef || `REM-${Date.now().toString().slice(-4)}`,
      remittanceDate: new Date().toISOString().split("T")[0],
      performedBy: "كاشير الفرع",
      status: "completed",
      notes: remittanceNotes,
    });

    toast.success(`تم تسجيل توريد ${fmt(amt)} ${cur} بنجاح`);
    setIsRemittanceOpen(false);
    setRemittanceAmount("");
    setRemittanceNotes("");
    refreshBranchData();
  };

  const handleCloseShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const actual = parseFloat(zActualCash);
    const opening = parseFloat(zOpeningCash) || 0;
    if (isNaN(actual) || actual < 0) {
      toast.error("يرجى إدخال النقدية الفعلية المحصية بالدرج");
      return;
    }
    if (!activeBranch) return;

    const shift = closeBranchShift({
      branchId: activeBranch.id,
      cashierName: zCashierName,
      openingBalance: opening,
      actualCashCounted: actual,
      invoices,
      payments,
      expenses,
      varianceReason: zVarianceReason,
      notes: "تم الإغلاق بنهاية الوردية",
    });

    toast.success(`تم تقفيل الوردية رقم ${shift.shiftNumber} بنجاح`);
    setIsZReportOpen(false);
    refreshBranchData();

    printBranchShiftZReport(shift, activeBranch, shopSettings, "thermal");
  };

  const handleSaveStaff = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const memberData: Omit<BranchStaffMember, "id"> = {
      branchId: form.get("branchId") as string,
      name: form.get("name") as string,
      role: form.get("role") as any,
      phone: form.get("phone") as string,
      salary: parseFloat(form.get("salary") as string) || 0,
      nationalId: form.get("nationalId") as string,
      active: form.get("active") === "on",
      hiredDate: (form.get("hiredDate") as string) || new Date().toISOString().split("T")[0],
    };

    if (editingStaff) {
      updateBranchStaffMember(editingStaff.id, memberData);
      toast.success("تم تحديث بيانات الموظف بنجاح");
    } else {
      addBranchStaffMember(memberData);
      toast.success("تمت إضافة الموظف الجديد بنجاح");
    }
    setIsStaffDialogOpen(false);
    setEditingStaff(null);
    refreshBranchData();
  };

  const value: BranchesContextValue = {
    branches, addBranch, updateBranch, removeBranch,
    stockItems, invoices, expenses, payments, loading,
    shopSettings, cur,
    activeTab, setActiveTab,
    selectedBranchId, setSelectedBranchId,
    activeBranch,
    totalValuation,
    isBranchDialogOpen, setIsBranchDialogOpen,
    editingBranch, setEditingBranch,
    editingBranchProfile,
    handleSaveBranch,
    transfers,
    isCreateTransferOpen, setIsCreateTransferOpen,
    transferFrom, setTransferFrom,
    transferTo, setTransferTo,
    transferDriver, setTransferDriver,
    transferNotes, setTransferNotes,
    transferItems, setTransferItems,
    inspectTransfer, setInspectTransfer,
    receiveModalOpen, setReceiveModalOpen,
    receiveTargetTransfer, setReceiveTargetTransfer,
    receivedItemInputs, setReceivedItemInputs,
    handleAddTransferItem, handleCreateTransferSubmit,
    handleDispatch, handleOpenReceive, handleConfirmReceive, handleCancelTransfer,
    remittances, shifts,
    isRemittanceOpen, setIsRemittanceOpen,
    isZReportOpen, setIsZReportOpen,
    remittanceAmount, setRemittanceAmount,
    remittanceDest, setRemittanceDest,
    remittanceDestName, setRemittanceDestName,
    remittanceRef, setRemittanceRef,
    remittanceNotes, setRemittanceNotes,
    zOpeningCash, setZOpeningCash,
    zActualCash, setZActualCash,
    zCashierName, setZCashierName,
    zVarianceReason, setZVarianceReason,
    handleAddRemittanceSubmit, handleCloseShiftSubmit,
    staffList,
    isStaffDialogOpen, setIsStaffDialogOpen,
    editingStaff, setEditingStaff,
    roleSimulatorBranch, setRoleSimulatorBranch,
    handleSaveStaff,
    stockSearch, setStockSearch,
    stockFilterLow, setStockFilterLow,
    refreshBranchData,
  };

  return (
    <BranchesContext.Provider value={value}>
      {children}
    </BranchesContext.Provider>
  );
}
