"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, User, Settings, Check } from "lucide-react";
import { useFamilyStore } from "@/store/familyStore";
import { useAuthStore } from "@/store/authStore";
import Avatar from "@/components/ui/Avatar";
import type { Profile } from "@/types";

export default function TopBar({ profile }: { profile: Profile | null }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [familyMenuOpen, setFamilyMenuOpen] = useState(false);
  const { families, activeFamilyId, setActiveFamily } = useFamilyStore();
  const { clearAuth } = useAuthStore();

  const activeFamily = families.find((f) => f.id === activeFamilyId);

  const handleSignOut = () => {
    clearAuth();
    router.replace("/auth");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-bg-1/80 backdrop-blur-xl border-b border-border flex items-center px-4 gap-3">
      {/* Family selector — always a dropdown */}
      <div className="flex-1">
        {families.length > 0 ? (
          <div className="relative">
            <button
              onClick={() => setFamilyMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-semibold text-text hover:text-accent transition-colors"
            >
              <span className="truncate max-w-[160px]">
                {activeFamily?.name ?? "Select Family"}
              </span>
              <ChevronDown
                size={14}
                className={`text-text-muted transition-transform ${familyMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {familyMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setFamilyMenuOpen(false)}
                />
                <div className="absolute top-full left-0 mt-2 bg-bg-2 border border-border rounded-xl shadow-card py-1 min-w-[200px] z-50">
                  {families.map((f) => {
                    const isActive = f.id === activeFamilyId;
                    return (
                      <button
                        key={f.id}
                        onClick={() => {
                          setActiveFamily(f.id);
                          setFamilyMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                          isActive
                            ? "text-accent font-medium"
                            : "text-text hover:bg-bg-3"
                        }`}
                      >
                        <span className="truncate">{f.name}</span>
                        {isActive && <Check size={14} className="shrink-0" />}
                      </button>
                    );
                  })}
                  <div className="border-t border-border mt-1 pt-1">
                    <button
                      onClick={() => {
                        router.push("/family");
                        setFamilyMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-text-muted hover:bg-bg-3 transition-colors"
                    >
                      Manage families…
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <span className="text-sm font-semibold text-gradient">
            Family Circle
          </span>
        )}
      </div>

      {/* User menu */}
      <div className="relative">
        <button onClick={() => setMenuOpen((v) => !v)}>
          <Avatar
            src={profile?.avatar}
            name={profile?.name ?? "U"}
            size={32}
          />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full mt-2 bg-bg-2 border border-border rounded-xl shadow-card py-1 min-w-[160px] z-50">
              <button
                onClick={() => {
                  router.push("/profile");
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-text hover:bg-bg-3 transition-colors"
              >
                <User size={14} /> Profile
              </button>
              <button
                onClick={() => {
                  router.push("/family");
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-text hover:bg-bg-3 transition-colors"
              >
                <Settings size={14} /> Family
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-error hover:bg-bg-3 transition-colors"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
