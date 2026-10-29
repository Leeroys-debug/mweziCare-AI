import * as React from "react";
import Link from "next/link";
import { cn } from "./lib/utils";

export interface BottomNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}

export interface BottomNavProps {
  items: BottomNavItem[];
  ariaLabel: string;
}

export function BottomNav({ items, ariaLabel }: BottomNavProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-neutral-800 dark:bg-neutral-950"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium transition-colors duration-150 motion-safe:active:scale-95",
                item.active
                  ? "text-brand-700 dark:text-brand-400"
                  : "text-neutral-500 hover:text-brand-600 dark:text-neutral-400",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-7 w-11 items-center justify-center rounded-full transition-colors duration-150",
                  item.active && "bg-brand-100 dark:bg-brand-950",
                )}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
