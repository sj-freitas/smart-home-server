import React from "react";
import { TimePreset, Granularity } from "../types";

const PRESETS: {
  label: string;
  value: TimePreset;
  granularity: Granularity;
}[] = [
  { label: "1h", value: "1h", granularity: "minute" },
  { label: "6h", value: "6h", granularity: "minute" },
  { label: "24h", value: "24h", granularity: "hour" },
  { label: "7d", value: "7d", granularity: "hour" },
  { label: "30d", value: "30d", granularity: "day" },
  { label: "Custom", value: "custom", granularity: "hour" },
];

export function presetToRange(preset: TimePreset): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);

  switch (preset) {
    case "1h":
      from.setHours(from.getHours() - 1);
      break;
    case "6h":
      from.setHours(from.getHours() - 6);
      break;
    case "24h":
      from.setHours(from.getHours() - 24);
      break;
    case "7d":
      from.setDate(from.getDate() - 7);
      break;
    case "30d":
      from.setDate(from.getDate() - 30);
      break;
    case "custom":
      from.setDate(from.getDate() - 7);
      break;
  }

  return { from, to };
}

export function defaultGranularityForPreset(preset: TimePreset): Granularity {
  return PRESETS.find((p) => p.value === preset)?.granularity ?? "hour";
}

interface TimeRangeSelectorProps {
  activePreset: TimePreset;
  customFrom: string;
  customTo: string;
  granularity: Granularity;
  onPresetChange: (preset: TimePreset) => void;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  onGranularityChange: (g: Granularity) => void;
}

export function TimeRangeSelector({
  activePreset,
  customFrom,
  customTo,
  granularity,
  onPresetChange,
  onCustomFromChange,
  onCustomToChange,
  onGranularityChange,
}: TimeRangeSelectorProps) {
  return (
    <div style={containerStyle}>
      <div style={rowStyle}>
        <span style={labelStyle}>Time range:</span>
        <div style={buttonGroupStyle}>
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => onPresetChange(p.value)}
              style={presetButtonStyle(activePreset === p.value)}
              type="button"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {activePreset === "custom" && (
        <div style={rowStyle}>
          <span style={labelStyle}>From:</span>
          <input
            type="datetime-local"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
            style={inputStyle}
          />
          <span style={labelStyle}>To:</span>
          <input
            type="datetime-local"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
            style={inputStyle}
          />
        </div>
      )}

      <div style={rowStyle}>
        <span style={labelStyle}>Granularity:</span>
        <select
          value={granularity}
          onChange={(e) => onGranularityChange(e.target.value as Granularity)}
          style={selectStyle}
        >
          <option value="raw">Raw</option>
          <option value="minute">Minute</option>
          <option value="hour">Hour</option>
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </select>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "12px 0",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const labelStyle: React.CSSProperties = {
  color: "#aaa",
  fontSize: 13,
  minWidth: 80,
};

const buttonGroupStyle: React.CSSProperties = {
  display: "flex",
  gap: 4,
};

function presetButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: "4px 12px",
    border: `1px solid ${active ? "#5c8ce0" : "#444"}`,
    borderRadius: 4,
    background: active ? "#1e3a6e" : "#1a1a2e",
    color: active ? "#fff" : "#aaa",
    cursor: "pointer",
    fontSize: 13,
  };
}

const inputStyle: React.CSSProperties = {
  background: "#1a1a2e",
  border: "1px solid #444",
  borderRadius: 4,
  color: "#eee",
  padding: "4px 8px",
  fontSize: 13,
};

const selectStyle: React.CSSProperties = {
  background: "#1a1a2e",
  border: "1px solid #444",
  borderRadius: 4,
  color: "#eee",
  padding: "4px 8px",
  fontSize: 13,
};
