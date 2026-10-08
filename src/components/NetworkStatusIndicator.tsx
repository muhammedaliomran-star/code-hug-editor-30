import { useNetworkStatus } from "@/lib/offline-sync";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

export function NetworkStatusIndicator() {
  const { isOnline, pendingCount, isSyncing, triggerSync } = useNetworkStatus();

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="fixed top-3 right-3 left-3 sm:left-auto sm:w-[440px] rounded-2xl bg-warning/20 border border-warning/30 px-4 py-2.5 text-warning flex items-center justify-between gap-3 text-xs sm:text-sm font-medium z-[60] backdrop-blur-md shadow-xl"
      >
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <>
              <WifiOff className="w-4 h-4 text-warning" />
              <span>أنت غير متصل بالإنترنت — العمل مستمر أوفلاين وسيتم حفظ الدفعات محليًا</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>تم استعادة الاتصال — يوجد {pendingCount} دفعة بانتظار المزامنة</span>
            </>
          )}
        </div>

        {isOnline && pendingCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={triggerSync}
            disabled={isSyncing}
            className="h-10 text-xs gap-1.5 px-3 border-warning/40 hover:bg-warning/20 text-warning"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "جاري المزامنة..." : "مزامنة الآن"}
          </Button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
