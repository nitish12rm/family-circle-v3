"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Profile } from "@/types";

interface AuthState {
  token: string | null;
  user: { id: string; email: string; name: string } | null;
  profile: Profile | null;
  profileLoaded: boolean;
  setAuth: (token: string, user: AuthState["user"]) => void;
  setProfile: (profile: Profile) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      profile: null,
      profileLoaded: false,
      setAuth: (token, user) => set({ token, user, profileLoaded: false }),
      setProfile: (profile) => set({ profile, profileLoaded: true }),
      clearAuth: () =>
        set({ token: null, user: null, profile: null, profileLoaded: false }),
    }),
    {
      name: "fc-auth",
      partialize: (s) => ({ token: s.token, user: s.user }),
    }
  )
);
