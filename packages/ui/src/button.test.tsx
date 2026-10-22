import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("Button", () => {
  it("renders its label", () => {
    render(<Button>Open the app</Button>);
    expect(
      screen.getByRole("button", { name: "Open the app" }),
    ).toBeInTheDocument();
  });

  it("is disabled when the disabled prop is set", () => {
    render(<Button disabled>Open the app</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
