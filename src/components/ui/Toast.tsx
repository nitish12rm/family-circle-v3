"use client";
import { CheckCircle, XCircle, Info, X } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import type { Toast as ToastType } from "@/types";

function ToastItem({ toast }: { toast: ToastType }) {
  const removeToast = useUIStore((s) => s.removeToast);

  const icons = {
    success: <CheckCircle size={16} className="text-success shrink-0" />,
    error: <XCircle size={16} className="text-error shrink-0" />,
    info: <Info size={16} className="text-accent shrink-0" />,
  };

  return (
    <div className="flex items-center gap-3 bg-bg-3 border border-border rounded-xl px-4 py-3 shadow-card animate-slide-up min-w-[260px] max-w-sm">
      {icons[toast.type]}
      <span className="text-sm text-text flex-1">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-text-muted hover:text-text transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
