import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/lib/notifications";

export function NotificationPrompt() {
  const { supported, isEnabled, requestPermission, disable } = useNotifications();

  if (!supported) return null;

  if (isEnabled) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={disable}
        className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
      >
        <BellOff className="h-3.5 w-3.5" />
        إيقاف الإشعارات
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void requestPermission()}
      className="gap-1.5 text-xs"
    >
      <Bell className="h-3.5 w-3.5" />
      فعّل إشعارات الشحن
    </Button>
  );
}
