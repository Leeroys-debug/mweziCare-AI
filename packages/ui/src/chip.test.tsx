import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Chip } from "./chip";

describe("Chip", () => {
  it("renders its label and reflects the selected state via aria-pressed", () => {
    render(<Chip selected>Lower abdomen</Chip>);
    const chip = screen.getByRole("button", { name: "Lower abdomen" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("reflects an unselected state", () => {
    render(<Chip selected={false}>Lower back</Chip>);
    expect(screen.getByRole("button", { name: "Lower back" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("calls onClick when tapped", () => {
    const onClick = vi.fn();
    render(
      <Chip selected={false} onClick={onClick}>
        Pelvis
      </Chip>,
    );
    screen.getByRole("button", { name: "Pelvis" }).click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
