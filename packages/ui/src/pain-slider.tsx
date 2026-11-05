"use client";

import * as React from "react";
import { cn } from "./lib/utils";

/** Anchors the two ends of the scale — no pain to worst pain. */
const FIRST_FACE = "😀";
const LAST_FACE = "😭";

export interface PainSliderProps {
  value: number;
  onChange: (value: number) => void;
  /** Accessible label for the control, e.g. "Pain". */
  label: string;
  /** Localized label per point, index 0-max (e.g. "No pain" ... "Worst pain"). */
  valueLabels: string[];
  /** Top of the scale — defaults to 10 (the 0-10 pain score). */
  max?: number;
  id?: string;
  className?: string;
}

/**
 * 0-max integer scale as a single draggable slider (native `<input
 * type="range">` so dragging, tapping-to-jump, and keyboard stepping all
 * come from the browser rather than hand-rolled pointer handling). 0 stays
 * on the scale even though it's drawn as the slider's left end — "none"
 * (no pain, 0 hours, etc.) is a meaningful, common value to record, not
 * something to make harder to reach. Despite the name, also reused for
 * other 0-max scales shaped like pain (e.g. pain duration in hours) rather
 * than renamed, since the faces/interaction are equally apt there.
 */
export function PainSlider({
  value,
  onChange,
  label,
  valueLabels,
  max = 10,
  id,
  className,
}: PainSliderProps) {
  const pointLabel = valueLabels[value] ?? "";
  const inputId = id ? `${id}-input` : undefined;

  return (
    <div className={cn("flex flex-col gap-3", className)} id={id}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          {label}
        </label>
        <span className="text-sm font-semibold text-brand-700 dark:text-brand-400">
          {value} · {pointLabel}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="shrink-0 text-xl leading-none">
          {FIRST_FACE}
        </span>
        <input
          id={inputId}
          type="range"
          min={0}
          max={max}
          step={1}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={label}
          aria-valuetext={`${value} — ${pointLabel}`}
          className={cn(
            "h-2 w-full cursor-pointer touch-none rounded-full accent-brand-700",
            "[&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7",
            "[&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7",
          )}
        />
        <span aria-hidden="true" className="shrink-0 text-xl leading-none">
          {LAST_FACE}
        </span>
      </div>
      <div
        aria-hidden="true"
        className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400"
      >
        <span>0</span>
        <span>{Math.round(max / 2)}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
