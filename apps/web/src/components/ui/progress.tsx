// If I change, please update my header comment.
// input: props/style deps
// output: base UI
// pos: base component
import * as React from "react"

import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, ...props }, ref) => {
    const normalizedValue = Math.max(0, Math.min(100, value ?? 0));

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={normalizedValue}
        className={cn(
          "relative h-4 w-full overflow-hidden rounded-full bg-muted",
          className
        )}
        {...props}
      >
        <div
          className="h-full w-full flex-1 bg-primary transition-transform"
          style={{ transform: `translateX(-${100 - normalizedValue}%)` }}
        />
      </div>
    );
  }
)
Progress.displayName = "Progress"

export { Progress }
