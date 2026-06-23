import React from "react";
import { RoomState } from "../types";

interface RoomSelectorProps {
  rooms: RoomState[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function RoomSelector({
  rooms,
  selectedIds,
  onChange,
}: RoomSelectorProps) {
  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((r) => r !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function selectAll() {
    onChange(rooms.map((r) => r.id));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={labelStyle}>Rooms:</span>
        <button type="button" onClick={selectAll} style={smallButtonStyle}>
          All
        </button>
        <button type="button" onClick={clearAll} style={smallButtonStyle}>
          None
        </button>
      </div>
      <div style={roomListStyle}>
        {rooms.map((room) => {
          const checked = selectedIds.includes(room.id);
          return (
            <label key={room.id} style={checkboxLabelStyle(checked)}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(room.id)}
                style={{ marginRight: 6 }}
              />
              {room.name}
            </label>
          );
        })}
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "8px 0",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const labelStyle: React.CSSProperties = {
  color: "#aaa",
  fontSize: 13,
  minWidth: 80,
};

const smallButtonStyle: React.CSSProperties = {
  padding: "2px 8px",
  border: "1px solid #444",
  borderRadius: 4,
  background: "#1a1a2e",
  color: "#aaa",
  cursor: "pointer",
  fontSize: 12,
};

const roomListStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

function checkboxLabelStyle(checked: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    padding: "4px 10px",
    border: `1px solid ${checked ? "#5c8ce0" : "#333"}`,
    borderRadius: 4,
    background: checked ? "#162040" : "#111",
    color: checked ? "#fff" : "#888",
    cursor: "pointer",
    fontSize: 13,
  };
}
