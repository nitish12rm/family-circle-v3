"use client";
import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useFamilyStore } from "@/store/familyStore";
import { api } from "@/lib/api";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import ToastContainer from "@/components/ui/Toast";
import type { Profile, Family } from "@/types";

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { token, user, profile, profileLoaded, setProfile, clearAuth } =
    useAuthStore();
  const { setFamilies } = useFamilyStore();

  // Auth guard
  useEffect(() => {
    if (!token) {
      router.replace("/auth");
    }
  }, [token, router]);

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

  if (!token || !user) return null;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <TopBar profile={profile} />
      <main className="flex-1 pt-14 pb-20 overflow-y-auto">{children}</main>
      <BottomNav />
      <ToastContainer />
    </div>
  );
}
