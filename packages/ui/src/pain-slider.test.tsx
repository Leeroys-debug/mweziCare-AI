import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PainSlider } from "./pain-slider";

const valueLabels = [
  "No pain",
  "Very mild",
  "Mild",
  "Mild-moderate",
  "Moderate",
  "Moderate",
  "Moderate-severe",
  "Severe",
  "Severe",
  "Very severe",
  "Worst pain",
];

describe("PainSlider", () => {
  it("renders with the accessible label and marks the current value as checked", () => {
    render(
      <PainSlider
        value={4}
        onChange={() => {}}
        label="Pain"
        valueLabels={valueLabels}
      />,
    );
    const group = screen.getByRole("radiogroup", { name: "Pain" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "4 — Moderate" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByText("4 · Moderate")).toBeInTheDocument();
  });

  it("calls onChange with the new numeric value on click", () => {
    const onChange = vi.fn();
    render(
      <PainSlider
        value={0}
        onChange={onChange}
        label="Pain"
        valueLabels={valueLabels}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "7 — Severe" }));
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it("moves to the next value on ArrowRight", () => {
    const onChange = vi.fn();
    render(
      <PainSlider
        value={3}
        onChange={onChange}
        label="Pain"
        valueLabels={valueLabels}
      />,
    );
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("exposes a descriptive accessible name for each option", () => {
    render(
      <PainSlider
        value={10}
        onChange={() => {}}
        label="Pain"
        valueLabels={valueLabels}
      />,
    );
    expect(
      screen.getByRole("radio", { name: "10 — Worst pain" }),
    ).toHaveAttribute("aria-checked", "true");
  });
});
