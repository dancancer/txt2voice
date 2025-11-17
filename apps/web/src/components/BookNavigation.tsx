"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FileText, Users, Play, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { TabsTrigger } from "@/components/ui/tabs";

interface BookNavigationProps {
  bookId: string;
  currentTab?: string;
}

const bookTabs = [
  {
    id: "overview",
    name: "概览",
    href: "",
    icon: List,
  },
  {
    id: "segments",
    name: "文本段落",
    href: "/segments",
    icon: FileText,
  },
  {
    id: "characters",
    name: "角色配置(测试)",
    href: "/characters",
    icon: Users,
  },
  {
    id: "script",
    name: "台本生成",
    href: "/script",
    icon: FileText,
  },
  {
    id: "audio",
    name: "音频生成",
    href: "/audio",
    icon: Play,
  },
  {
    id: "play",
    name: "播放",
    href: "/play",
    icon: Play,
  },
];

export function BookNavigation({ bookId, currentTab }: BookNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = pathname?.replace(/\/$/, "") || "";
  const basePath = `/books/${bookId}`;

  const detectedTab = useMemo(() => {
    return (
      currentTab ||
      bookTabs.find((tab) => {
        if (tab.href === "") {
          return currentPath === basePath;
        }
        return currentPath.startsWith(`${basePath}${tab.href}`);
      })?.id ||
      "overview"
    );
  }, [basePath, currentPath, currentTab]);

  const [selectedTab, setSelectedTab] = useState<string>(detectedTab);

  useEffect(() => {
    setSelectedTab(detectedTab);
  }, [detectedTab]);

  const handleNavigate = (tabId: string, href: string) => {
    if (tabId === selectedTab) {
      return;
    }
    setSelectedTab(tabId);
    router.push(href);
  };

  return (
    <div className="bg-white border-b border-gray-200 ">
      <div className="container mx-auto px-4">
        {/* 标签页导航 */}
        <div className="flex items-center overflow-x-auto">
          <div className="flex flex-1 flex-wrap gap-2  p-2 max-w-7xl">
            {bookTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = selectedTab === tab.id;
              const href = `/books/${bookId}${tab.href}`;

              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  activeTab={selectedTab}
                  setActiveTab={() => handleNavigate(tab.id, href)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition",
                    isActive
                      ? "bg-white text-blue-600 shadow-md"
                      : "bg-transparent text-gray-600 hover:bg-white hover:text-gray-900"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </TabsTrigger>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
