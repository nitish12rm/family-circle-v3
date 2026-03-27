"use client";
import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useFamilyStore } from "@/store/familyStore";
import { useNotificationStore } from "@/store/notificationStore";
import { api } from "@/lib/api";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import ToastContainer from "@/components/ui/Toast";
import PWAInstallBanner from "@/components/ui/PWAInstallBanner";
import Spinner from "@/components/ui/Spinner";
import type { Profile, Family } from "@/types";

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { token, user, profile, profileLoaded, _hasHydrated, setProfile, clearAuth } =
    useAuthStore();
  const { setFamilies } = useFamilyStore();
  const { fetch: fetchNotifications, startPolling, stopPolling } = useNotificationStore();

  // Auth guard — wait for localStorage hydration before deciding
  useEffect(() => {
    if (!_hasHydrated) return;
    if (!token) {
      router.replace("/auth");
    }
  }, [_hasHydrated, token, router]);

  // Load profile
  useEffect(() => {
    if (!token || profileLoaded) return;
    api
      .get<Profile>("/api/profile")
      .then((p) => {
        setProfile(p);
        if (!p.onboarding_complete) {
          router.replace("/onboarding");
        }
      })
      .catch(() => clearAuth());
  }, [token, profileLoaded, setProfile, clearAuth, router]);

  // Load families
  useEffect(() => {
    if (!token) return;
    api
      .get<Family[]>("/api/families")
      .then(setFamilies)
      .catch(() => {});
  }, [token, setFamilies]);

  // Start FCM / polling transport when authenticated; stop on sign-out
  useEffect(() => {
    if (!token) {
      stopPolling();
      return;
    }
    fetchNotifications();
    startPolling();
    return () => stopPolling();
  }, [token, fetchNotifications, startPolling, stopPolling]);

  // Request push permission + register FCM token (silent — never blocks auth)
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        if (typeof window === "undefined" || !("Notification" in window)) return;
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const { getFirebaseMessaging } = await import("@/lib/firebase");
        const { getToken } = await import("firebase/messaging");
        const messaging = await getFirebaseMessaging();
        if (!messaging) return;

        // Register Firebase SW at a dedicated scope so it doesn't clash with next-pwa
        const swReg = await navigator.serviceWorker.register(
          "/api/firebase-messaging-sw",
          { scope: "/firebase-cloud-messaging-push-scope" }
        );

        const fcmToken = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });
        if (fcmToken) {
          api.post("/api/profile/fcm-token", { token: fcmToken }).catch(() => {});
        }
      } catch { /* permission denied or FCM not configured — silent */ }
    })();
  }, [token]);

  // Show spinner while hydrating from localStorage
  if (!_hasHydrated) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!token || !user) return null;

  return (
    <div className="bg-bg flex flex-col overflow-hidden" style={{ height: "100dvh" }}>
      <TopBar profile={profile} />
      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingTop: "var(--topbar-h)", paddingBottom: "var(--bottomnav-h)" }}
      >
        {children}
      </main>
      <BottomNav />
      <PWAInstallBanner />
      <ToastContainer />
    </div>
  );
}
