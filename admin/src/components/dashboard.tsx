import React, { useEffect, useState } from "react";
import { ClimateChart } from "./climate-chart";
import { TimeRangeSelector, presetToRange, defaultGranularityForPreset } from "./time-range-selector";
import { RoomSelector } from "./room-selector";
import { DeviceFilter } from "./device-filter";
import { useRooms } from "../hooks/use-rooms";
import { useClimateMetrics } from "../hooks/use-climate-metrics";
import { useDeviceActions } from "../hooks/use-device-actions";
import { Granularity, TimePreset } from "../types";

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface DashboardProps {
  onLogout: () => void;
}

export function Dashboard({ onLogout }: DashboardProps) {
  const { rooms, loading: roomsLoading } = useRooms();

  const [activePreset, setActivePreset] = useState<TimePreset>("24h");
  const [granularity, setGranularity] = useState<Granularity>("hour");
  const [timeRange, setTimeRange] = useState(() => presetToRange("24h"));
  const [customFrom, setCustomFrom] = useState(() => toDatetimeLocal(presetToRange("7d").from));
  const [customTo, setCustomTo] = useState(() => toDatetimeLocal(new Date()));
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [showHumidity, setShowHumidity] = useState(false);

  // Auto-select all rooms once they load
  useEffect(() => {
    if (rooms.length > 0 && selectedRoomIds.length === 0) {
      setSelectedRoomIds(rooms.map((r) => r.id));
    }
  }, [rooms]);

  function handlePresetChange(preset: TimePreset) {
    setActivePreset(preset);
    if (preset !== "custom") {
      setTimeRange(presetToRange(preset));
      setGranularity(defaultGranularityForPreset(preset));
    }
  }

  function handleCustomApply() {
    const from = new Date(customFrom);
    const to = new Date(customTo);
    if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
      setTimeRange({ from, to });
    }
  }

  const { series, loading: climateLoading, error: climateError, refetch } = useClimateMetrics({
    roomIds: selectedRoomIds,
    from: timeRange.from,
    to: timeRange.to,
    granularity,
  });

  const { events: deviceActions, loading: actionsLoading } = useDeviceActions({
    roomIds: selectedRoomIds,
    deviceIds: selectedDeviceIds.length > 0 ? selectedDeviceIds : undefined,
    from: timeRange.from,
    to: timeRange.to,
  });

  const allDeviceIds = [...new Set(deviceActions.map((e) => e.deviceId))];

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: 20, color: "#eee" }}>Smart Home Dashboard</h1>
        <button type="button" onClick={onLogout} style={logoutButtonStyle}>
          Log out
        </button>
      </header>

      <main style={mainStyle}>
        <section style={controlsStyle}>
          <TimeRangeSelector
            activePreset={activePreset}
            customFrom={customFrom}
            customTo={customTo}
            granularity={granularity}
            onPresetChange={handlePresetChange}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
            onGranularityChange={setGranularity}
          />

          {activePreset === "custom" && (
            <button type="button" onClick={handleCustomApply} style={applyButtonStyle}>
              Apply
            </button>
          )}

          {roomsLoading ? (
            <p style={mutedStyle}>Loading rooms…</p>
          ) : (
            <RoomSelector
              rooms={rooms}
              selectedIds={selectedRoomIds}
              onChange={setSelectedRoomIds}
            />
          )}

          <div style={toggleRowStyle}>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={showHumidity}
                onChange={(e) => setShowHumidity(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Show humidity
            </label>

            <button type="button" onClick={refetch} style={refetchButtonStyle}>
              ↻ Refresh
            </button>
          </div>

          {allDeviceIds.length > 0 && (
            <DeviceFilter
              events={deviceActions}
              selectedDeviceIds={selectedDeviceIds}
              onChange={setSelectedDeviceIds}
            />
          )}
        </section>

        <section style={chartSectionStyle}>
          {climateError && (
            <p style={{ color: "#e05c5c", fontSize: 13 }}>Error: {climateError}</p>
          )}
          {(climateLoading || actionsLoading) && (
            <p style={mutedStyle}>Loading…</p>
          )}
          <ClimateChart
            series={series}
            deviceActions={deviceActions}
            showHumidity={showHumidity}
            selectedDeviceIds={selectedDeviceIds}
          />
        </section>
      </main>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0f0f1e",
  color: "#eee",
  fontFamily: "system-ui, sans-serif",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 24px",
  borderBottom: "1px solid #2a2a3e",
  background: "#0d0d1a",
};

const logoutButtonStyle: React.CSSProperties = {
  padding: "6px 14px",
  border: "1px solid #444",
  borderRadius: 4,
  background: "transparent",
  color: "#aaa",
  cursor: "pointer",
  fontSize: 13,
};

const mainStyle: React.CSSProperties = {
  padding: "20px 24px",
  maxWidth: 1400,
  margin: "0 auto",
};

const controlsStyle: React.CSSProperties = {
  background: "#13132a",
  border: "1px solid #2a2a3e",
  borderRadius: 8,
  padding: "16px 20px",
  marginBottom: 20,
};

const chartSectionStyle: React.CSSProperties = {
  background: "#13132a",
  border: "1px solid #2a2a3e",
  borderRadius: 8,
  padding: "16px 20px",
};

const toggleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "4px 0",
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  color: "#aaa",
  fontSize: 13,
  cursor: "pointer",
};

const mutedStyle: React.CSSProperties = {
  color: "#666",
  fontSize: 13,
};

const applyButtonStyle: React.CSSProperties = {
  padding: "6px 16px",
  border: "1px solid #5c8ce0",
  borderRadius: 4,
  background: "#1e3a6e",
  color: "#fff",
  cursor: "pointer",
  fontSize: 13,
  marginTop: 4,
};

const refetchButtonStyle: React.CSSProperties = {
  padding: "4px 12px",
  border: "1px solid #444",
  borderRadius: 4,
  background: "#1a1a2e",
  color: "#aaa",
  cursor: "pointer",
  fontSize: 12,
};
