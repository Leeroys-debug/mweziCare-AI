"use client";

import * as React from "react";
import { cn } from "./lib/utils";

/**
 * The two most severe points on the 0-10 scale get a face next to the
 * number, as a quick visual flag for "this is the bad end" — everything
 * below just reads as a plain number so the control is a single
 * draggable 0-10 slider rather than a row of individually-tappable faces.
 */
const SEVERE_FACES: Record<number, string> = {
  9: "😖",
  10: "😭",
};

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
 * 0-10 pain scale as a single draggable slider (native `<input type="range">`
 * so dragging, tapping-to-jump, and keyboard stepping all come from the
 * browser rather than hand-rolled pointer handling). 0 stays on the scale
 * even though it's drawn as the slider's left end — "no pain today" is a
 * meaningful, common value to record, not something to make harder to reach.
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
  const face = SEVERE_FACES[value];
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
        <span className="flex items-center gap-1 text-sm font-semibold text-brand-700 dark:text-brand-400">
          {face && (
            <span aria-hidden="true" className="text-base leading-none">
              {face}
            </span>
          )}
          {value} · {pointLabel}
        </span>
      </div>
      <input
        id={inputId}
        type="range"
        min={0}
        max={10}
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
      <div
        aria-hidden="true"
        className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400"
      >
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
}
