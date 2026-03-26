"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown, Check, Settings, LogOut, User, FileText,
  Users, Trash2, X, Plus,
} from "lucide-react";
import { useFamilyStore } from "@/store/familyStore";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import { useUIStore } from "@/store/uiStore";
import type { Profile } from "@/types";

export default function TopBar({ profile }: { profile: Profile | null }) {
  const router = useRouter();
  const [familyMenuOpen, setFamilyMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Delete account state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const { families, activeFamilyId, setActiveFamily } = useFamilyStore();
  const { clearAuth } = useAuthStore();
  const { showToast } = useUIStore();

  const activeFamily = families.find((f) => f.id === activeFamilyId);

  const handleSignOut = () => {
    setSettingsOpen(false);
    clearAuth();
    router.replace("/auth");
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "delete" || deleting) return;
    setDeleting(true);
    try {
      await api.delete("/api/profile");
      clearAuth();
      router.replace("/auth");
    } catch {
      showToast("Failed to delete account", "error");
      setDeleting(false);
    }
  };

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-40 bg-bg-1 border-b border-border flex items-center px-4 gap-3"
        style={{ height: "var(--topbar-h)", paddingTop: "var(--sat)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-xl bg-accent flex items-center justify-center shrink-0">
            <span className="text-white text-[11px] font-black tracking-tight">FC</span>
          </div>
          <span className="text-sm font-bold text-gradient hidden sm:block">Family Circle</span>
        </div>

        {/* Family switcher — center */}
        <div className="flex-1 flex justify-center">
          {families.length > 0 ? (
            <div className="relative">
              <button
                onClick={() => setFamilyMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 bg-bg-2 border border-border rounded-full px-3 py-1.5 text-xs font-semibold text-text hover:border-accent/60 transition-colors max-w-[180px]"
              >
                <span className="truncate">{activeFamily?.name ?? "Select Family"}</span>
                <ChevronDown
                  size={12}
                  className={`text-text-muted shrink-0 transition-transform ${familyMenuOpen ? "rotate-180" : ""}`}
                />
              </button>

              {familyMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setFamilyMenuOpen(false)} />
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-bg-2 border border-border rounded-xl shadow-card py-1 min-w-[200px] z-50">
                    <p className="px-4 pt-1 pb-2 text-[10px] font-semibold text-text-faint uppercase tracking-wider">Your Families</p>
                    {families.map((f) => {
                      const isActive = f.id === activeFamilyId;
                      return (
                        <button
                          key={f.id}
                          onClick={() => { setActiveFamily(f.id); setFamilyMenuOpen(false); }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                            isActive ? "text-accent font-medium" : "text-text hover:bg-bg-3"
                          }`}
                        >
                          <span className="truncate">{f.name}</span>
                          {isActive && <Check size={13} className="shrink-0" />}
                        </button>
                      );
                    })}
                    <div className="border-t border-border mt-1 pt-1">
                      <button
                        onClick={() => { router.push("/family"); setFamilyMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-text-muted hover:bg-bg-3 transition-colors"
                      >
                        <Plus size={12} /> Join or create family
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <span className="text-sm font-bold text-gradient">Family Circle</span>
          )}
        </div>

        {/* Settings button */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="shrink-0 p-2 rounded-xl text-text-muted hover:text-text hover:bg-bg-2 transition-colors"
        >
          <Settings size={19} strokeWidth={1.8} />
        </button>
      </header>

      {/* Settings bottom sheet */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="bg-bg w-full max-w-xl rounded-t-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <Avatar src={profile?.avatar} name={profile?.name ?? "U"} size={38} />
                <div>
                  <p className="text-sm font-semibold text-text">{profile?.name ?? "Account"}</p>
                  <p className="text-xs text-text-faint">{profile?.email ?? ""}</p>
                </div>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="p-1 text-text-faint hover:text-text">
                <X size={16} />
              </button>
            </div>

            {/* Menu items */}
            <div className="py-2">
              <button
                onClick={() => { setSettingsOpen(false); router.push("/profile"); }}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-bg-2 transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <User size={15} className="text-accent" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-text">My Profile</p>
                  <p className="text-xs text-text-faint">Edit bio, avatar, personal info</p>
                </div>
              </button>

              <button
                onClick={() => { setSettingsOpen(false); router.push("/documents"); }}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-bg-2 transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <FileText size={15} className="text-blue-500" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-text">Documents</p>
                  <p className="text-xs text-text-faint">Files & photos shared with your family</p>
                </div>
              </button>

              <button
                onClick={() => { setSettingsOpen(false); router.push("/family"); }}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-bg-2 transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                  <Users size={15} className="text-green-500" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-text">Manage Families</p>
                  <p className="text-xs text-text-faint">Members, invites, leave or delete</p>
                </div>
              </button>

              <div className="mx-5 my-1 border-t border-border" />

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-bg-2 transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-text-faint/10 flex items-center justify-center shrink-0">
                  <LogOut size={15} className="text-text-muted" />
                </div>
                <p className="text-sm font-medium text-text-muted">Sign Out</p>
              </button>

              <button
                onClick={() => { setDeleteOpen(true); }}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-bg-2 transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-error/10 flex items-center justify-center shrink-0">
                  <Trash2 size={15} className="text-error" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-error">Delete Account</p>
                  <p className="text-xs text-text-faint">Permanently remove all your data</p>
                </div>
              </button>
            </div>

            <div className="pb-8" />
          </div>
        </div>
      )}

      {/* Delete account confirmation */}
      {deleteOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6"
          onClick={() => { setDeleteOpen(false); setDeleteConfirm(""); }}
        >
          <div className="bg-bg rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <Trash2 size={16} className="text-error" />
              <h3 className="text-sm font-semibold text-text">Delete account?</h3>
            </div>
            <p className="text-xs text-text-muted mb-4">
              This permanently deletes your profile, posts, documents, and all activity. This cannot be undone.
            </p>
            <p className="text-xs text-text-muted mb-2">
              Type <span className="font-semibold text-error">delete</span> to confirm
            </p>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="delete"
              className="w-full bg-bg-2 border border-border rounded-xl px-3 py-2 text-sm text-text placeholder:text-text-faint outline-none focus:border-error mb-4 transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteOpen(false); setDeleteConfirm(""); }}
                className="flex-1 py-2 rounded-xl border border-border text-sm text-text-muted hover:bg-bg-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== "delete" || deleting}
                className="flex-1 py-2 rounded-xl bg-error text-white text-sm font-medium disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
              >
                {deleting ? <Spinner size={14} /> : <Trash2 size={14} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
