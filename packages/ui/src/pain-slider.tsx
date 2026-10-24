"use client";

import * as React from "react";
import { cn } from "./lib/utils";

/** Wong-Baker-style face progression, index 0-10. */
const FACES = [
  "😀",
  "🙂",
  "🙂",
  "😐",
  "😐",
  "😕",
  "😕",
  "😣",
  "😣",
  "😖",
  "😭",
];

export interface PainSliderProps {
  value: number;
  onChange: (value: number) => void;
  /** Accessible label for the control, e.g. "Pain". */
  label: string;
  /** Localized label per point, index 0-10 (e.g. "No pain" ... "Worst pain"). */
  valueLabels: string[];
  id?: string;
  className?: string;
}

/**
 * 0-10 pain scale as a row of tappable face buttons rather than a drag
 * slider — a thin drag track is an easy miss target one-handed, especially
 * mid-cramp; tapping a face is a single reliable gesture. `role="radiogroup"`
 * of `radio`s (not a native `<input type="range">`) because the interaction
 * is "pick one of 11 discrete options," which is exactly what that ARIA
 * pattern models, including its built-in arrow-key roving behavior.
 */
export function PainSlider({
  value,
  onChange,
  label,
  valueLabels,
  id,
  className,
}: PainSliderProps) {
  const pointLabel = valueLabels[value] ?? "";
  const buttonRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  function selectAndFocus(next: number) {
    const clamped = Math.max(0, Math.min(FACES.length - 1, next));
    onChange(clamped);
    buttonRefs.current[clamped]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        selectAndFocus(value + 1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        selectAndFocus(value - 1);
        break;
      case "Home":
        event.preventDefault();
        selectAndFocus(0);
        break;
      case "End":
        event.preventDefault();
        selectAndFocus(FACES.length - 1);
        break;
    }
  }

  return (
    <div className={cn("flex flex-col gap-3", className)} id={id}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {label}
        </span>
        <span className="text-sm font-semibold text-brand-700 dark:text-brand-400">
          {value} · {pointLabel}
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label={label}
        onKeyDown={handleKeyDown}
        // The group itself isn't a tab stop — focus lives on the individual
        // radios via roving tabIndex below — but jsx-a11y requires an
        // explicit tabIndex on any element carrying an interactive role.
        tabIndex={-1}
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {FACES.map((face, i) => {
          const selected = i === value;
          return (
            <button
              key={i}
              ref={(el) => {
                buttonRefs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${i} — ${valueLabels[i] ?? ""}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(i)}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2",
                selected
                  ? "border-brand-700 bg-brand-700"
                  : "border-neutral-300 bg-white hover:bg-brand-50 dark:border-neutral-700 dark:bg-neutral-900",
              )}
            >
              <span aria-hidden="true">{face}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
