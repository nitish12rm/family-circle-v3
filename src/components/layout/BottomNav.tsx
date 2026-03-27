"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Home, GitBranch, MessageCircle, User, Plus, PenLine, CheckSquare } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";

const leftTabs = [
  { href: "/feed", icon: Home,      label: "Feed" },
  { href: "/tree", icon: GitBranch, label: "Tree" },
];
const rightTabs = [
  { href: "/chat",    icon: MessageCircle, label: "Chat" },
  { href: "/profile", icon: User,          label: "Profile" },
];

const fabItems = [
  { id: "post", label: "Post",  icon: PenLine,     color: "bg-accent" },
  { id: "todo", label: "To-Do", icon: CheckSquare, color: "bg-purple-500" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { token } = useAuthStore();
  const { setOpenCreatePost } = useUIStore();
  const [unread, setUnread] = useState(0);
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

  // Close FAB when tapping outside
  useEffect(() => {
    if (!fabOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setFabOpen(false);
      }
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

  function NavTab({ href, icon: Icon, label, badge }: {
    href: string; icon: React.ElementType; label: string; badge?: number;
  }) {
    const active = pathname === href || pathname.startsWith(href + "?");
    return (
      <Link
        href={href}
        className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
          active ? "text-accent" : "text-text-muted hover:text-text"
        }`}
      >
        <div className="relative">
          <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
          {active && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent rounded-full" />
          )}
          {badge && badge > 0 && !active && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </div>
        <span className="text-[10px] font-medium">{label}</span>
      </Link>
    );
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-bg-1 border-t border-border"
      style={{ height: "var(--bottomnav-h)" }}
    >
      <div className="h-20 flex items-center justify-around px-2 relative">
        {/* Left tabs */}
        {leftTabs.map(({ href, icon, label }) => (
          <NavTab key={href} href={href} icon={icon} label={label} />
        ))}

        {/* FAB centre slot */}
        <div ref={fabRef} className="relative flex flex-col items-center justify-center">
          {/* Slide-up menu */}
          <div
            className={`absolute bottom-full mb-3 flex flex-col items-end gap-2.5 transition-all duration-200 ${
              fabOpen
                ? "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 translate-y-4 pointer-events-none"
            }`}
          >
            {fabItems.map(({ id, label, icon: Icon, color }) => (
              <button
                key={id}
                onClick={() => handleFabItem(id)}
                className="flex items-center gap-2.5 pr-3.5 pl-1.5 py-1.5 rounded-2xl bg-bg-1 border border-border shadow-xl text-sm font-medium text-text whitespace-nowrap"
              >
                <span className={`${color} w-8 h-8 rounded-xl flex items-center justify-center shrink-0`}>
                  <Icon size={16} className="text-white" strokeWidth={2} />
                </span>
                {label}
              </button>
            ))}
          </div>

          {/* FAB button */}
          <button
            onClick={() => setFabOpen((v) => !v)}
            className={`w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center transition-all duration-200 ${
              fabOpen
                ? "bg-accent/85 scale-95"
                : "bg-accent hover:bg-accent/90 active:scale-95"
            }`}
            style={{ marginBottom: "4px" }}
          >
            <Plus
              size={26}
              className={`text-white transition-transform duration-200 ${fabOpen ? "rotate-45" : "rotate-0"}`}
              strokeWidth={2.5}
            />
          </button>
        </div>

        {/* Right tabs */}
        {rightTabs.map(({ href, icon, label }) => (
          <NavTab
            key={href}
            href={href}
            icon={icon}
            label={label}
            badge={href === "/chat" ? unread : undefined}
          />
        ))}
      </div>
    </nav>
  );
}
