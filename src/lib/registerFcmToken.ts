import { api } from "@/lib/api";

/**
 * Registers this device's FCM token and saves it to the server.
 * Does NOT request notification permission — caller must ensure permission
 * is already granted (Safari requires this from a user gesture).
 */
export async function registerFcmToken(): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const { getFirebaseMessaging } = await import("@/lib/firebase");
  const { getToken } = await import("firebase/messaging");
  const messaging = await getFirebaseMessaging();
  if (!messaging) return;

  const swReg = await navigator.serviceWorker.register("/api/firebase-messaging-sw");

  await new Promise<void>((resolve) => {
    if (swReg.active) { resolve(); return; }
    const sw = swReg.installing ?? swReg.waiting;
    sw?.addEventListener("statechange", function handler(e) {
      if ((e.target as ServiceWorker).state === "activated") {
        sw.removeEventListener("statechange", handler);
        resolve();
      }
    });
  });

  const fcmToken = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: swReg,
  });

  if (fcmToken) {
    api.post("/api/profile/fcm-token", { token: fcmToken }).catch(() => {});
  }
}
