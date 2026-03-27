"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Home, GitBranch, MessageCircle, User, Plus, PenLine, CheckSquare } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";

const leftTabs  = [
  { href: "/feed", icon: Home,          label: "Feed" },
  { href: "/tree", icon: GitBranch,     label: "Tree" },
];
const rightTabs = [
  { href: "/chat",    icon: MessageCircle, label: "Chat" },
  { href: "/profile", icon: User,          label: "Profile" },
];

const fabItems = [
  { id: "todo", label: "To-Do", icon: CheckSquare, iconBg: "bg-purple-500/15 text-purple-400", border: "border-purple-500/25" },
  { id: "post", label: "Post",  icon: PenLine,     iconBg: "bg-accent/15 text-accent",         border: "border-accent/25" },
];

export default function BottomNav() {
  const pathname   = usePathname();
  const router     = useRouter();
  const { token }  = useAuthStore();
  const { setOpenCreatePost } = useUIStore();
  const [unread, setUnread]   = useState(0);
  const [fabOpen, setFabOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    const fetch = () =>
      api.get<{ total: number }>("/api/chat/unread")
        .then((d) => setUnread(d.total))
        .catch(() => {});
    fetch();
    const t = setInterval(fetch, 15_000);
    return () => clearInterval(t);
  }, [token]);

  useEffect(() => {
    if (pathname.startsWith("/chat")) setUnread(0);
  }, [pathname]);

  useEffect(() => {
    if (!fabOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) setFabOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [fabOpen]);

  const handleFabItem = (id: string) => {
    setFabOpen(false);
    if (id === "post") {
      if (!pathname.startsWith("/feed")) {
        router.push("/feed");
        setTimeout(() => setOpenCreatePost(true), 350);
      } else {
        setOpenCreatePost(true);
      }
    } else if (id === "todo") {
      router.push("/todos?new=1");
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-bg-1 border-t border-border"
      style={{ height: "var(--bottomnav-h)" }}
    >
      <div className="h-20 flex items-center justify-around px-2">
        {/* Left tabs */}
        {leftTabs.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "?");
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${active ? "text-accent" : "text-text-muted hover:text-text"}`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                {active && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent rounded-full" />}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}

        {/* FAB */}
        <div ref={fabRef} className="relative flex flex-col items-center" style={{ marginBottom: "8px" }}>
          {/* Backdrop blur overlay */}
          {fabOpen && (
            <div className="fixed inset-0 z-[-1]" onClick={() => setFabOpen(false)} />
          )}

          {/* Menu */}
          <div
            className={`absolute bottom-full mb-3 flex flex-col gap-2 transition-all duration-200 origin-bottom ${
              fabOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
            }`}
          >
            {fabItems.map(({ id, label, icon: Icon, iconBg, border }) => (
              <button
                key={id}
                onClick={() => handleFabItem(id)}
                className={`w-36 flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-bg-1 border ${border} shadow-xl`}
              >
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                  <Icon size={15} strokeWidth={2} />
                </span>
                <span className="text-sm font-medium text-text">{label}</span>
              </button>
            ))}
          </div>

          {/* Button */}
          <button
            onClick={() => setFabOpen((v) => !v)}
            className={`w-12 h-12 rounded-2xl border flex items-center justify-center shadow-md transition-all duration-200 active:scale-95 ${
              fabOpen
                ? "bg-accent/10 border-accent/40 text-accent"
                : "bg-bg-2 border-border text-text-muted hover:border-accent/40 hover:text-accent"
            }`}
          >
            <Plus
              size={22}
              strokeWidth={2.2}
              className={`transition-transform duration-200 ${fabOpen ? "rotate-45" : "rotate-0"}`}
            />
          </button>
        </div>

        {/* Right tabs */}
        {rightTabs.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "?");
          const showBadge = href === "/chat" && unread > 0 && !active;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${active ? "text-accent" : "text-text-muted hover:text-text"}`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                {active && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent rounded-full" />}
                {showBadge && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
