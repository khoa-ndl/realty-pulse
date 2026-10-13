import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./sidebar";

describe("Sidebar", () => {
  it("renders all four dashboard nav items", () => {
    render(<Sidebar currentPath="/dashboard" />);
    expect(screen.getByRole("link", { name: /generate.*send/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /issue archive/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /subscribers/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /schedule status/i })).toBeInTheDocument();
  });

  it("marks the Issue Archive item active when currentPath is /dashboard/archive", () => {
    render(<Sidebar currentPath="/dashboard/archive" />);
    expect(screen.getByRole("link", { name: /issue archive/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /subscribers/i })).not.toHaveAttribute("aria-current");
  });

  it("marks the Subscribers item active when currentPath is /dashboard/subscribers", () => {
    render(<Sidebar currentPath="/dashboard/subscribers" />);
    expect(screen.getByRole("link", { name: /subscribers/i })).toHaveAttribute("aria-current", "page");
  });

  it("marks the Schedule Status item active when currentPath is /dashboard/schedule", () => {
    render(<Sidebar currentPath="/dashboard/schedule" />);
    expect(screen.getByRole("link", { name: /schedule status/i })).toHaveAttribute("aria-current", "page");
  });

  it("marks the Generate & Send item active when currentPath is /dashboard", () => {
    render(<Sidebar currentPath="/dashboard" />);
    expect(screen.getByRole("link", { name: /generate.*send/i })).toHaveAttribute("aria-current", "page");
  });
});
