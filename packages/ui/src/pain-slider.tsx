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

/** 0-10 pain scale with a face icon and a point-specific label — large touch target for fast, one-handed logging. */
export function PainSlider({
  value,
  onChange,
  label,
  valueLabels,
  id,
  className,
}: PainSliderProps) {
  const face = FACES[value] ?? FACES[0];
  const pointLabel = valueLabels[value] ?? "";

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {label}
        </span>
        <span className="text-3xl leading-none" aria-hidden="true">
          {face}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        aria-valuetext={`${value} — ${pointLabel}`}
        className="h-11 w-full cursor-pointer accent-emerald-700"
      />
      <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span>0</span>
        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
          {value} · {pointLabel}
        </span>
        <span>10</span>
      </div>
    </div>
  );
}
