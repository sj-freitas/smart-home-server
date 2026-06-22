import React from "react";
import { DeviceActionEvent } from "../types";

interface DeviceFilterProps {
  events: DeviceActionEvent[];
  selectedDeviceIds: string[];
  onChange: (ids: string[]) => void;
}

export function DeviceFilter({
  events,
  selectedDeviceIds,
  onChange,
}: DeviceFilterProps) {
  const deviceIds = [...new Set(events.map((e) => e.deviceId))];

  if (deviceIds.length === 0) {
    return null;
  }

  function toggle(id: string) {
    if (selectedDeviceIds.includes(id)) {
      onChange(selectedDeviceIds.filter((d) => d !== id));
    } else {
      onChange([...selectedDeviceIds, id]);
    }
  }

  return (
    <div style={containerStyle}>
      <span style={labelStyle}>Device overlays:</span>
      <div style={listStyle}>
        {deviceIds.map((id) => {
          const checked = selectedDeviceIds.includes(id);
          return (
            <label key={id} style={checkboxLabelStyle(checked)}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(id)}
                style={{ marginRight: 6 }}
              />
              {id}
            </label>
          );
        })}
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  padding: "6px 0",
};

const labelStyle: React.CSSProperties = {
  color: "#aaa",
  fontSize: 13,
  minWidth: 120,
};

const listStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

function checkboxLabelStyle(checked: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    padding: "3px 8px",
    border: `1px solid ${checked ? "#ff7300" : "#333"}`,
    borderRadius: 4,
    background: checked ? "#2a1800" : "#111",
    color: checked ? "#ff9a44" : "#777",
    cursor: "pointer",
    fontSize: 12,
  };
}
