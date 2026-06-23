import React, { useCallback, useEffect, useRef, useState } from "react";
import { ClimateChart } from "./climate-chart";
import {
  TimeRangeSelector,
  presetToRange,
  defaultGranularityForPreset,
} from "./time-range-selector";
import { RoomSelector } from "./room-selector";
import { DeviceFilter } from "./device-filter";
import { useRooms } from "../hooks/use-rooms";
import { useClimateMetrics } from "../hooks/use-climate-metrics";
import { useDeviceActions } from "../hooks/use-device-actions";
import {
  readDashboardCookie,
  writeDashboardCookie,
  savedPreset,
  savedGranularity,
  savedMode,
} from "../hooks/use-dashboard-cookie";
import { Granularity, TimePreset } from "../types";

const POLL_INTERVAL_MS = 2 * 60 * 1000;

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface DashboardProps {
  onLogout: () => void;
}

export function Dashboard({ onLogout }: DashboardProps) {
  const { rooms, loading: roomsLoading } = useRooms();

  // Initialise from cookie (lazy initialisers run once on mount)
  const [activePreset, setActivePreset] = useState<TimePreset>(() => {
    return savedPreset(readDashboardCookie());
  });
  const [granularity, setGranularity] = useState<Granularity>(() => {
    const saved = readDashboardCookie();
    const preset = savedPreset(saved);
    return savedGranularity(saved, defaultGranularityForPreset(preset));
  });
  const [timeRange, setTimeRange] = useState(() => {
    const saved = readDashboardCookie();
    const preset = savedPreset(saved);
    if (preset === "custom" && saved.customFrom && saved.customTo) {
      const from = new Date(saved.customFrom);
      const to = new Date(saved.customTo);
      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) return { from, to };
    }
    return presetToRange(preset);
  });
  const [customFrom, setCustomFrom] = useState(() => {
    const saved = readDashboardCookie();
    return saved.customFrom ?? toDatetimeLocal(presetToRange("7d").from);
  });
  const [customTo, setCustomTo] = useState(() => {
    const saved = readDashboardCookie();
    return saved.customTo ?? toDatetimeLocal(new Date());
  });
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"temperature" | "humidity">(() => {
    return savedMode(readDashboardCookie());
  });

  // Persist settings to cookie whenever they change
  useEffect(() => {
    writeDashboardCookie({
      preset: activePreset,
      granularity,
      mode,
      ...(activePreset === "custom" ? { customFrom, customTo } : {}),
    });
  }, [activePreset, granularity, mode, customFrom, customTo]);

  // Auto-select all rooms from useRooms once they load
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

  const {
    series,
    loading: climateLoading,
    error: climateError,
    refetch,
  } = useClimateMetrics({
    roomIds: selectedRoomIds,
    from: timeRange.from,
    to: timeRange.to,
    granularity,
  });

  // If useRooms hasn't loaded yet, populate the room selector from the series data
  useEffect(() => {
    if (
      rooms.length === 0 &&
      series.length > 0 &&
      selectedRoomIds.length === 0
    ) {
      setSelectedRoomIds(series.map((s) => s.roomId));
    }
  }, [series, rooms.length]);

  const {
    events: deviceActions,
    loading: actionsLoading,
    refetch: refetchActions,
  } = useDeviceActions({
    roomIds: selectedRoomIds,
    deviceIds: selectedDeviceIds.length > 0 ? selectedDeviceIds : undefined,
    from: timeRange.from,
    to: timeRange.to,
  });

  // Polling every 2 minutes — use refs so the interval closure never goes stale
  const refetchRef = useRef(refetch);
  const refetchActionsRef = useRef(refetchActions);
  useEffect(() => {
    refetchRef.current = refetch;
  });
  useEffect(() => {
    refetchActionsRef.current = refetchActions;
  });

  useEffect(() => {
    const id = setInterval(() => {
      refetchRef.current();
      refetchActionsRef.current();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const selectorRooms =
    rooms.length > 0
      ? rooms
      : series.map((s) => ({ id: s.roomId, name: s.roomName, devices: [] }));

  const allDeviceIds = [...new Set(deviceActions.map((e) => e.deviceId))];

  const handleRefresh = useCallback(() => {
    refetch();
    refetchActions();
  }, [refetch, refetchActions]);

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: 20, color: "#eee" }}>
          Smart Home Dashboard
        </h1>
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
            <button
              type="button"
              onClick={handleCustomApply}
              style={applyButtonStyle}
            >
              Apply
            </button>
          )}

          {roomsLoading && selectorRooms.length === 0 ? (
            <p style={mutedStyle}>Loading rooms…</p>
          ) : (
            <RoomSelector
              rooms={selectorRooms}
              selectedIds={selectedRoomIds}
              onChange={setSelectedRoomIds}
            />
          )}

          <div style={toggleRowStyle}>
            <div style={tabGroupStyle} role="tablist">
              <button
                role="tab"
                type="button"
                aria-selected={mode === "temperature"}
                onClick={() => setMode("temperature")}
                style={tabButtonStyle(mode === "temperature")}
              >
                Temperature
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={mode === "humidity"}
                onClick={() => setMode("humidity")}
                style={tabButtonStyle(mode === "humidity")}
              >
                Humidity
              </button>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              style={refetchButtonStyle}
            >
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
            <p style={{ color: "#e05c5c", fontSize: 13 }}>
              Error: {climateError}
            </p>
          )}
          {(climateLoading || actionsLoading) && (
            <p style={mutedStyle}>Loading…</p>
          )}
          <ClimateChart
            series={series}
            deviceActions={deviceActions}
            mode={mode}
            selectedDeviceIds={selectedDeviceIds}
            rooms={rooms}
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

const tabGroupStyle: React.CSSProperties = {
  display: "flex",
  borderRadius: 6,
  overflow: "hidden",
  border: "1px solid #3a3a5a",
};

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: "5px 18px",
    border: "none",
    background: active ? "#2a2a5e" : "transparent",
    color: active ? "#fff" : "#888",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    transition: "background 0.15s, color 0.15s",
  };
}

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
