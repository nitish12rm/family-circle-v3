"use client";
import { create } from "zustand";
import type { Toast } from "@/types";

interface UIState {
  toasts: Toast[];
  showToast: (message: string, type?: Toast["type"]) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  showToast: (message, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      4000
    );
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
