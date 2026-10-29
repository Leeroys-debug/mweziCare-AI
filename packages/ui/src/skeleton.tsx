import * as React from "react";
import { cn } from "./lib/utils";

/**
 * Loading placeholder — swap in wherever a useQuery's `data` is still
 * undefined, instead of a blank gap or a spinner, so the layout doesn't
 * jump once real content arrives. motion-safe: the pulse is pure
 * decoration, so it's dropped under prefers-reduced-motion (WCAG 2.2 AA).
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "motion-safe:animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800",
        className,
      )}
      {...props}
    />
  );
}
