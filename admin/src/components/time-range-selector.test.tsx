import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TimeRangeSelector, presetToRange, defaultGranularityForPreset } from "./time-range-selector";

describe("presetToRange", () => {
  it("returns a range roughly 1 hour wide for preset '1h'", () => {
    const { from, to } = presetToRange("1h");
    const diffMs = to.getTime() - from.getTime();
    expect(diffMs).toBeCloseTo(60 * 60 * 1000, -4);
  });

  it("returns a range roughly 7 days wide for preset '7d'", () => {
    const { from, to } = presetToRange("7d");
    const diffMs = to.getTime() - from.getTime();
    expect(diffMs).toBeCloseTo(7 * 24 * 60 * 60 * 1000, -7);
  });
});

describe("defaultGranularityForPreset", () => {
  it("returns minute for 1h preset", () => {
    expect(defaultGranularityForPreset("1h")).toBe("minute");
  });

  it("returns hour for 24h preset", () => {
    expect(defaultGranularityForPreset("24h")).toBe("hour");
  });

  it("returns day for 30d preset", () => {
    expect(defaultGranularityForPreset("30d")).toBe("day");
  });
});

function renderSelector(overrides?: Partial<Parameters<typeof TimeRangeSelector>[0]>) {
  const props = {
    activePreset: "24h" as const,
    customFrom: "2024-01-01T00:00",
    customTo: "2024-01-02T00:00",
    granularity: "hour" as const,
    onPresetChange: jest.fn(),
    onCustomFromChange: jest.fn(),
    onCustomToChange: jest.fn(),
    onGranularityChange: jest.fn(),
    ...overrides,
  };
  render(<TimeRangeSelector {...props} />);
  return props;
}

describe("TimeRangeSelector", () => {
  it("renders all preset buttons", () => {
    renderSelector();
    for (const label of ["1h", "6h", "24h", "7d", "30d", "Custom"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("calls onPresetChange when a preset button is clicked", () => {
    const { onPresetChange } = renderSelector();
    fireEvent.click(screen.getByRole("button", { name: "7d" }));
    expect(onPresetChange).toHaveBeenCalledWith("7d");
  });

  it("shows custom date inputs when activePreset is custom", () => {
    renderSelector({ activePreset: "custom" });
    expect(screen.getAllByDisplayValue(/2024/)).toHaveLength(2);
  });

  it("does not show custom date inputs for non-custom presets", () => {
    renderSelector({ activePreset: "24h" });
    expect(screen.queryAllByDisplayValue(/2024/)).toHaveLength(0);
  });

  it("calls onGranularityChange when the select changes", () => {
    const { onGranularityChange } = renderSelector();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "day" } });
    expect(onGranularityChange).toHaveBeenCalledWith("day");
  });
});
