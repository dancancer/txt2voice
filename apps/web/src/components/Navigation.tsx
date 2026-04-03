// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 复用 UI
// pos: 共享组件
"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Menu, Mic, ListTodo, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <nav className={cn("flex items-center gap-2", className)}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.name}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 min-w-11 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive
                ? "bg-card text-foreground shadow-sm ring-1 ring-border/80"
                : "text-muted-foreground hover:bg-accent/80 hover:text-foreground"
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
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/78">
      <div className="container mx-auto py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-card text-accent-foreground shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Text to Voice
              </h1>
              <p className="text-sm text-muted-foreground">智能文本转语音平台</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Navigation className="hidden md:flex" />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-xl md:hidden"
                  aria-label="打开导航菜单"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  sideOffset={8}
                  align="end"
                  className="z-50 min-w-[13rem] rounded-2xl border border-border/80 bg-popover p-1.5 text-popover-foreground shadow-[0_16px_40px_rgba(15,23,42,0.14)]"
                >
                  {navItems.map((item) => {
                    const isActive =
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href);

                    return (
                      <DropdownMenu.Item key={item.href} asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex min-h-11 items-center gap-2 rounded-xl px-3 py-2.5 text-sm outline-none transition-colors",
                            isActive
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:bg-accent/80 hover:text-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.name}</span>
                        </Link>
                      </DropdownMenu.Item>
                    );
                  })}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <Button
              asChild
              size="sm"
              className="rounded-xl px-3.5 shadow-sm"
            >
              <Link href="/?create=1" aria-label="上传书籍">
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">上传书籍</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
