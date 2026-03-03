// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 复用 UI
// pos: 共享组件
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { FileText, Users, Play, LayoutList, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookNavigationProps {
  bookId: string;
}

type BookTab = {
  id: string;
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  isGlobal?: boolean;
};

const bookTabs: BookTab[] = [
  {
    id: "overview",
    name: "概览",
    href: "",
    icon: LayoutList,
  },
  {
    id: "characters",
    name: "角色配置",
    href: "/characters",
    icon: Users,
  },
  {
    id: "studio-script",
    name: "高级台本",
    href: "/studio/script",
    icon: FileText,
  },
  {
    id: "studio-audio",
    name: "高级音频",
    href: "/studio/audio",
    icon: Play,
  },
  {
    id: "play",
    name: "播放",
    href: "/play",
    icon: Play,
  },
  {
    id: "tasks",
    name: "任务中心",
    href: "/tasks",
    icon: ListTodo,
    isGlobal: true,
  },
];

const resolveTabHref = (bookId: string, tab: BookTab) => {
  if (tab.isGlobal) {
    return tab.href;
  }
  return `/books/${bookId}${tab.href}`;
};

const isOverviewPath = (path: string, basePath: string) => {
  return path === basePath || path.startsWith(`${basePath}/chapters`);
};

export function BookNavigation({ bookId }: BookNavigationProps) {
  const pathname = usePathname();
  const normalizedPath = pathname?.replace(/\/$/, "") || "";
  const basePath = `/books/${bookId}`;

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav
          className="flex items-center gap-2 overflow-x-auto py-2"
          aria-label="书籍内导航"
        >
          {bookTabs.map((tab) => {
            const Icon = tab.icon;
            const href = resolveTabHref(bookId, tab);
            const active = tab.isGlobal
              ? normalizedPath === tab.href
              : tab.id === "overview"
              ? isOverviewPath(normalizedPath, basePath)
              : normalizedPath.startsWith(href);

            return (
              <Link
                key={tab.id}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 min-w-11 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
