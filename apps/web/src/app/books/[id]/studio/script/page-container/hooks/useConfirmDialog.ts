// 一旦我被更新，请更新我的开头注释
// input: Hook 状态与交互参数
// output: 确认弹窗状态与控制方法
// pos: 页面容器 Hook
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ConfirmDialogConfig = {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

export type ConfirmDialogState = {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
  destructive: boolean;
};

const DEFAULT_STATE: ConfirmDialogState = {
  open: false,
  title: "",
  description: "",
  confirmText: "确认",
  cancelText: "取消",
  destructive: false,
};

export function useConfirmDialog() {
  const resolverRef = useRef<((accepted: boolean) => void) | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(
    DEFAULT_STATE
  );

  const resolveConfirmation = useCallback((accepted: boolean) => {
    setConfirmDialog((prev) => ({ ...prev, open: false }));
    if (!resolverRef.current) {
      return;
    }

    const resolver = resolverRef.current;
    resolverRef.current = null;
    resolver(accepted);
  }, []);

  const requestConfirmation = useCallback((config: ConfirmDialogConfig) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setConfirmDialog({
        open: true,
        title: config.title,
        description: config.description,
        confirmText: config.confirmText || "确认",
        cancelText: config.cancelText || "取消",
        destructive: Boolean(config.destructive),
      });
    });
  }, []);

  useEffect(() => {
    return () => {
      if (!resolverRef.current) {
        return;
      }

      resolverRef.current(false);
      resolverRef.current = null;
    };
  }, []);

  return {
    confirmDialog,
    requestConfirmation,
    resolveConfirmation,
  };
}
