// 一旦我被更新，请更新我的开头注释
// input: 朗读参数 props
// output: 统一规格条展示
// pos: 页面组件
import { cn } from "@/lib/utils";

type ProsodyValue = {
  pace?: number;
  pitch?: number;
  energy?: number;
  pauseMsAfter?: number;
};

interface ScriptProsodyDisplayProps {
  strength?: number;
  pauseAfter?: number;
  prosody?: ProsodyValue;
  className?: string;
  compact?: boolean;
}

type ProsodyItem = {
  key: string;
  label: string;
  value: string;
};

const formatSignedNumber = (value: number) =>
  `${value > 0 ? "+" : ""}${value.toFixed(2)}`;

export const buildProsodyItems = (params: {
  strength?: number;
  pauseAfter?: number;
  prosody?: ProsodyValue;
}): ProsodyItem[] => {
  const items: ProsodyItem[] = [];

  if (typeof params.strength === "number") {
    items.push({
      key: "strength",
      label: "强度",
      value: `${params.strength}`,
    });
  }

  if (typeof params.pauseAfter === "number") {
    items.push({
      key: "pauseAfter",
      label: "停顿",
      value: `${params.pauseAfter.toFixed(1)}s`,
    });
  }

  if (typeof params.prosody?.pace === "number") {
    items.push({
      key: "pace",
      label: "语速",
      value: params.prosody.pace.toFixed(2),
    });
  }

  if (typeof params.prosody?.pitch === "number") {
    items.push({
      key: "pitch",
      label: "音高",
      value: formatSignedNumber(params.prosody.pitch),
    });
  }

  if (typeof params.prosody?.energy === "number") {
    items.push({
      key: "energy",
      label: "能量",
      value: params.prosody.energy.toFixed(2),
    });
  }

  if (typeof params.prosody?.pauseMsAfter === "number") {
    items.push({
      key: "pauseMsAfter",
      label: "尾停",
      value: `${Math.round(params.prosody.pauseMsAfter)}ms`,
    });
  }

  return items;
};

export function ScriptProsodyDisplay({
  strength,
  pauseAfter,
  prosody,
  className,
  compact = false,
}: ScriptProsodyDisplayProps) {
  const items = buildProsodyItems({ strength, pauseAfter, prosody });

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground",
        compact ? "gap-x-2" : "gap-x-3",
        className
      )}
      data-testid="script-prosody-display"
    >
      {items.map((item) => (
        <span
          key={item.key}
          className="inline-flex items-center gap-1 whitespace-nowrap"
        >
          <span className="text-[11px] font-medium tracking-[0.02em] text-foreground/75">
            {item.label}
          </span>
          <span>{item.value}</span>
        </span>
      ))}
    </div>
  );
}
