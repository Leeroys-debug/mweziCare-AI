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
  it("renders with the accessible label and current value", () => {
    render(
      <PainSlider
        value={4}
        onChange={() => {}}
        label="Pain"
        valueLabels={valueLabels}
      />,
    );
    const slider = screen.getByRole("slider", { name: "Pain" });
    expect(slider).toHaveValue("4");
    expect(screen.getByText("4 · Moderate")).toBeInTheDocument();
  });

  it("calls onChange with the new numeric value", () => {
    const onChange = vi.fn();
    render(
      <PainSlider
        value={0}
        onChange={onChange}
        label="Pain"
        valueLabels={valueLabels}
      />,
    );
    const slider = screen.getByRole("slider", { name: "Pain" });
    fireEvent.change(slider, { target: { value: "7" } });
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it("exposes a descriptive aria-valuetext for screen readers", () => {
    render(
      <PainSlider
        value={10}
        onChange={() => {}}
        label="Pain"
        valueLabels={valueLabels}
      />,
    );
    expect(screen.getByRole("slider")).toHaveAttribute(
      "aria-valuetext",
      "10 — Worst pain",
    );
  });
});
