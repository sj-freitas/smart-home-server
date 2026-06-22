import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ClimateChart } from "./climate-chart";
import { ClimateSeries, DeviceActionEvent } from "../types";

// Recharts uses ResizeObserver and SVG which are not available in jsdom
jest.mock("recharts", () => {
  const React = require("react");

  const mockComponents = [
    "ComposedChart",
    "Line",
    "Scatter",
    "XAxis",
    "YAxis",
    "CartesianGrid",
    "Tooltip",
    "Legend",
    "Brush",
    "ReferenceLine",
    "ResponsiveContainer",
  ];

  const mocks: Record<string, React.FC> = {};
  for (const name of mockComponents) {
    mocks[name] = ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", { "data-testid": name }, children);
  }
  return mocks;
});

function makeSeries(roomId = "living-room", count = 3): ClimateSeries {
  const data = Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(Date.UTC(2024, 0, 1, i)).toISOString(),
    temperature: 20 + i,
    humidity: 45,
  }));
  return { roomId, roomName: "Living Room", data };
}

describe("ClimateChart", () => {
  const noActions: DeviceActionEvent[] = [];

  it("renders the empty state when there are no series", () => {
    render(
      <ClimateChart
        series={[]}
        deviceActions={noActions}
        showHumidity={false}
        selectedDeviceIds={[]}
      />,
    );
    expect(
      screen.getByText(/No data for the selected rooms/i),
    ).toBeInTheDocument();
  });

  it("renders a chart container when series data is present", () => {
    render(
      <ClimateChart
        series={[makeSeries()]}
        deviceActions={noActions}
        showHumidity={false}
        selectedDeviceIds={[]}
      />,
    );
    expect(screen.getByTestId("ResponsiveContainer")).toBeInTheDocument();
  });

  it("renders humidity axis when showHumidity is true", () => {
    const { container } = render(
      <ClimateChart
        series={[makeSeries()]}
        deviceActions={noActions}
        showHumidity={true}
        selectedDeviceIds={[]}
      />,
    );
    // Two YAxis elements expected: one for temp (always) and one for humidity
    const axes = container.querySelectorAll('[data-testid="YAxis"]');
    expect(axes.length).toBe(2);
  });

  it("does not render humidity axis when showHumidity is false", () => {
    const { container } = render(
      <ClimateChart
        series={[makeSeries()]}
        deviceActions={noActions}
        showHumidity={false}
        selectedDeviceIds={[]}
      />,
    );
    const axes = container.querySelectorAll('[data-testid="YAxis"]');
    expect(axes.length).toBe(1);
  });
});
