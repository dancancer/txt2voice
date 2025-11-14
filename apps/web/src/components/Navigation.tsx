"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Mic, Users, Home, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigationProps {
  className?: string;
}

const navItems = [
  {
    name: "首页",
    href: "/",
    icon: Home,
  },
  {
    name: "我的书籍",
    href: "/",
    icon: BookOpen,
  },
  {
    name: "语音库",
    href: "/tts/speakers",
    icon: Mic,
    disabled: false,
  },
  {
    name: "角色管理",
    href: "/characters",
    icon: Users,
    disabled: true,
  },
];

export function Navigation({ className }: NavigationProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex items-center space-x-8", className)}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        const isDisabled = item.disabled;

        return (
          <Link
            key={item.name}
            href={isDisabled ? "#" : item.href}
            className={cn(
              "flex items-center space-x-2 text-sm font-medium transition-colors",
              isActive
                ? "text-blue-600"
                : isDisabled
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-600 hover:text-gray-900"
            )}
            onClick={(e) => isDisabled && e.preventDefault()}
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
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg">
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
