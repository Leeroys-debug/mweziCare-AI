import * as React from "react";
import { cn } from "./lib/utils";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
}

/** Toggleable chip for multi-select locations/symptoms — large tap target, `aria-pressed` for state. */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, selected, children, ...props }, ref) => {
    return (
      <button
        type="button"
        ref={ref}
        aria-pressed={selected}
        className={cn(
          "min-h-[44px] rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2",
          selected
            ? "border-emerald-700 bg-emerald-700 text-white"
            : "border-neutral-300 bg-white text-neutral-700 hover:bg-emerald-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Chip.displayName = "Chip";
