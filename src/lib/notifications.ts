import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

const NOTIFICATION_KEY = "segilly_notifications_enabled";

/**
 * Hook to manage push notification permission.
 * Uses the Notifications API + Service Worker for display.
 */
export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) {
      setSupported(false);
      return;
    }
    setSupported(true);
    setPermission(Notification.permission);
  }, []);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return "denied" as NotificationPermission;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      localStorage.setItem(NOTIFICATION_KEY, "true");
      toast.success("تم تفعيل الإشعارات");
    }
    return result;
  }, []);

  const disable = useCallback(() => {
    localStorage.removeItem(NOTIFICATION_KEY);
    setPermission("default");
  }, []);

  const isEnabled = permission === "granted" && localStorage.getItem(NOTIFICATION_KEY) === "true";

  return { permission, supported, isEnabled, requestPermission, disable };
}

/**
 * Send a local notification via the Service Worker.
 * Falls back to a toast if notifications are not available.
 */
export function sendNotification(title: string, body: string, options?: NotificationOptions) {
  if (Notification.permission === "granted" && navigator.serviceWorker?.controller) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        dir: "rtl",
        lang: "ar",
        tag: options?.tag ?? "segilly-notification",
        renotify: true,
        ...options,
      });
    });
  } else if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/icon-192.png", dir: "rtl", lang: "ar" });
  } else {
    toast.info(title, { description: body });
  }
}

/**
 * Check for late shipments and send notifications.
 * Called from the Shipping page or background sync.
 */
export function notifyLateShipments(lateCount: number) {
  if (lateCount <= 0) return;
  const key = `segilly_late_notified_${new Date().toDateString()}`;
  if (localStorage.getItem(key)) return;

  sendNotification(
    `${lateCount} شحن${lateCount > 1 ? "ات" : "ة"} متأخر${lateCount > 1 ? "ة" : ""}`,
    `في ${lateCount} شحن${lateCount > 1 ? "ات" : "ة"} تجاوز${lateCount > 1 ? "ت" : ""} موعد التسليم المتوقع. افتح صفحة الشحن للمراجعة.`,
    { tag: "late-shipments", data: { count: lateCount } }
  );
  localStorage.setItem(key, "true");
}
