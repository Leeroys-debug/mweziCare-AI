import * as React from "react";
import { cn } from "./lib/utils";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
  /** Optional leading icon, e.g. a lucide-react icon element — purely decorative, hidden from assistive tech. */
  icon?: React.ReactNode;
}

/** Toggleable chip for multi-select locations/symptoms — large tap target, `aria-pressed` for state. */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, selected, icon, children, ...props }, ref) => {
    return (
      <button
        type="button"
        ref={ref}
        aria-pressed={selected}
        className={cn(
          "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2",
          selected
            ? "border-brand-700 bg-brand-700 text-white"
            : "border-neutral-300 bg-white text-neutral-700 hover:bg-brand-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200",
          className,
        )}
        {...props}
      >
        {icon && (
          <span className="shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
        {children}
      </button>
    );
  },
);
Chip.displayName = "Chip";
