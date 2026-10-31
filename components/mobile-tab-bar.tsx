"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Swords, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "首页", href: "/", icon: Home, match: (p: string) => p === "/" },
  { label: "PK", href: "/pk", icon: Swords, match: (p: string) => p.startsWith("/pk") },
  { label: "自习室", href: "/study-room", icon: Users, match: (p: string) => p.startsWith("/study-room") },
  { label: "我的", href: "/profile", icon: User, match: (p: string) => p.startsWith("/profile") },
];

export function MobileTabBar() {
  const pathname = usePathname();

  // 闯关页 + 复习页 + 找词游戏隐藏底部 tab，沉浸式 + 避免遮挡底部按钮
  const isLessonQuiz = /^\/courses\/\d+\/lessons\/\d+/.test(pathname);
  const isReview = pathname.startsWith("/review");
  const isWordSearch = pathname.startsWith("/word-search");
  if (isLessonQuiz || isReview || isWordSearch) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-100 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 backdrop-blur-xl">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-colors",
                active
                  ? "text-gray-900 dark:text-white"
                  : "text-gray-400 dark:text-gray-500 active:scale-95"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
