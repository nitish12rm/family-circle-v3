"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, GitBranch, MessageCircle, User } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

const tabs = [
  { href: "/feed", icon: Home, label: "Feed" },
  { href: "/tree", icon: GitBranch, label: "Tree" },
  { href: "/chat", icon: MessageCircle, label: "Chat" },
  { href: "/profile", icon: User, label: "Profile" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { token } = useAuthStore();
  const [unread, setUnread] = useState(0);

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

  // Clear badge when user navigates to chat
  useEffect(() => {
    if (pathname.startsWith("/chat")) setUnread(0);
  }, [pathname]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-bg-1 border-t border-border"
      style={{ height: "var(--bottomnav-h)" }}
    >
      <div className="h-20 flex items-center justify-around px-2">
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "?");
          const showBadge = href === "/chat" && unread > 0 && !active;
          return (
            <Link
              key={href}
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
