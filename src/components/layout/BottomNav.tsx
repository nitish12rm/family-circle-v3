"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, GitBranch, MessageCircle, Users, FileText } from "lucide-react";

const tabs = [
  { href: "/feed", icon: Home, label: "Feed" },
  { href: "/tree", icon: GitBranch, label: "Tree" },
  { href: "/chat", icon: MessageCircle, label: "Chat" },
  { href: "/family", icon: Users, label: "Family" },
  { href: "/documents", icon: FileText, label: "Docs" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-bg-1 border-t border-border"
      style={{ height: "var(--bottomnav-h)" }}
    >
      <div className="h-20 flex items-center justify-around px-2">
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
                active
                  ? "text-accent"
                  : "text-text-muted hover:text-text"
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                {active && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent rounded-full" />
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
