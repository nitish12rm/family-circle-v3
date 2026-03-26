"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Family, FamilyMember } from "@/types";

interface FamilyState {
  families: Family[];
  activeFamilyId: string | null;
  members: FamilyMember[];
  setFamilies: (families: Family[]) => void;
  setActiveFamily: (id: string) => void;
  setMembers: (members: FamilyMember[]) => void;
  addFamily: (family: Family) => void;
  activeFamily: () => Family | null;
}

export const useFamilyStore = create<FamilyState>()(
  persist(
    (set, get) => ({
      families: [],
      activeFamilyId: null,
      members: [],
      setFamilies: (families) =>
        set((s) => ({
          families,
          activeFamilyId:
            s.activeFamilyId && families.find((f) => f.id === s.activeFamilyId)
              ? s.activeFamilyId
              : families[0]?.id ?? null,
        })),
      setActiveFamily: (id) => set({ activeFamilyId: id }),
      setMembers: (members) => set({ members }),
      addFamily: (family) =>
        set((s) => ({
          families: [...s.families, family],
          activeFamilyId: s.activeFamilyId ?? family.id,
        })),
      activeFamily: () => {
        const s = get();
        return s.families.find((f) => f.id === s.activeFamilyId) ?? null;
      },
    }),
    {
      name: "fc-family",
      partialize: (s) => ({
        families: s.families,
        activeFamilyId: s.activeFamilyId,
      }),
    }
  )
);
