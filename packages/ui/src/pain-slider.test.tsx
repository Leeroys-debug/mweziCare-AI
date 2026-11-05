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
  it("renders a 0-10 slider with the accessible label and current value", () => {
    render(
      <PainSlider
        value={4}
        onChange={() => {}}
        label="Pain"
        valueLabels={valueLabels}
      />,
    );
    const slider = screen.getByRole("slider", { name: "Pain" });
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "10");
    expect(slider).toHaveValue("4");
    expect(screen.getByText("4 · Moderate")).toBeInTheDocument();
  });

  it("calls onChange with the new numeric value when dragged", () => {
    const onChange = vi.fn();
    render(
      <PainSlider
        value={0}
        onChange={onChange}
        label="Pain"
        valueLabels={valueLabels}
      />,
    );
    fireEvent.change(screen.getByRole("slider", { name: "Pain" }), {
      target: { value: "7" },
    });
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it("always shows the first and last faces as fixed anchors, regardless of value", () => {
    const { rerender } = render(
      <PainSlider
        value={0}
        onChange={() => {}}
        label="Pain"
        valueLabels={valueLabels}
      />,
    );
    expect(screen.getByText("😀")).toBeInTheDocument();
    expect(screen.getByText("😭")).toBeInTheDocument();

    rerender(
      <PainSlider
        value={5}
        onChange={() => {}}
        label="Pain"
        valueLabels={valueLabels}
      />,
    );
    expect(screen.getByText("😀")).toBeInTheDocument();
    expect(screen.getByText("😭")).toBeInTheDocument();
  });

  it("supports a custom max for non-pain-score scales, e.g. 0-24 hours", () => {
    const hourLabels = Array.from({ length: 25 }, (_, h) => `${h} hours`);
    render(
      <PainSlider
        value={10}
        onChange={() => {}}
        label="Hours"
        valueLabels={hourLabels}
        max={24}
      />,
    );
    const slider = screen.getByRole("slider", { name: "Hours" });
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "24");
    expect(screen.getByText("10 · 10 hours")).toBeInTheDocument();
  });

  it("exposes a descriptive aria-valuetext for the current value", () => {
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
