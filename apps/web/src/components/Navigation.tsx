// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 复用 UI
// pos: 共享组件
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Mic, ListTodo, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigationProps {
  className?: string;
}

const navItems = [
  {
    name: "书籍管理",
    href: "/",
    icon: BookOpen,
  },
  {
    name: "任务中心",
    href: "/tasks",
    icon: ListTodo,
  },
  {
    name: "语音库",
    href: "/tts/speakers",
    icon: Mic,
  },
];

export function Navigation({ className }: NavigationProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex items-center space-x-8", className)}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "min-h-11 min-w-11 px-3 py-2 rounded-md inline-flex items-center gap-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
              isActive
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 h-[85px]">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3">
            <div className="p-2 bg-linear-to-r from-blue-600 to-indigo-600 rounded-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Text to Voice
              </h1>
              <p className="text-sm text-gray-600">智能文本转语音平台</p>
            </div>
          </Link>
          <Navigation className="hidden md:flex" />
        </div>
      </div>
    </header>
  );
}
