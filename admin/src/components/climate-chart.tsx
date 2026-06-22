import React, { useMemo } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
  TooltipProps,
} from "recharts";
import { ClimateSeries, DeviceActionEvent } from "../types";

// Colour palettes — room temperatures use warm tones, humidity uses cool dashes
const ROOM_COLORS = [
  "#e05c5c",
  "#e09c3c",
  "#5c8ce0",
  "#5ce05c",
  "#c05ce0",
  "#5ce0c8",
];

const DEVICE_COLORS = [
  "#ff7300",
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#a4de6c",
];

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAxisTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface MergedDataPoint {
  ts: number;
  [key: string]: number | null;
}

function mergeSeriesIntoTimeline(series: ClimateSeries[]): MergedDataPoint[] {
  const byTs = new Map<number, MergedDataPoint>();

  for (const room of series) {
    for (const point of room.data) {
      const ts = new Date(point.timestamp).getTime();
      if (!byTs.has(ts)) {
        byTs.set(ts, { ts });
      }
      const row = byTs.get(ts)!;
      if (point.temperature !== null) {
        row[`${room.roomId}_temp`] = point.temperature;
      }
      if (point.humidity !== null) {
        row[`${room.roomId}_hum`] = point.humidity;
      }
    }
  }

  return Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);
}

interface CustomTooltipPayloadEntry {
  name: string;
  value: number | null;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  deviceEvents,
}: TooltipProps<number, string> & {
  deviceEvents: Map<number, DeviceActionEvent[]>;
}) {
  if (!active || !payload?.length) return null;

  const ts = label as number;
  const events = deviceEvents.get(ts) ?? [];

  return (
    <div style={tooltipStyle}>
      <p style={{ margin: "0 0 4px", fontWeight: 600 }}>{formatTimestamp(ts)}</p>
      {(payload as CustomTooltipPayloadEntry[]).map((entry) => (
        <p key={entry.name} style={{ margin: "2px 0", color: entry.color }}>
          {entry.name}: {entry.value !== null ? entry.value.toFixed(1) : "—"}
        </p>
      ))}
      {events.map((e, i) => (
        <p key={i} style={{ margin: "2px 0", color: "#888", fontSize: 11 }}>
          ⚡ {e.deviceId}: {e.actionId}
        </p>
      ))}
    </div>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: "#1a1a2e",
  border: "1px solid #444",
  borderRadius: 6,
  padding: "8px 12px",
  color: "#eee",
  fontSize: 13,
};

interface ClimateChartProps {
  series: ClimateSeries[];
  deviceActions: DeviceActionEvent[];
  mode: "temperature" | "humidity";
  selectedDeviceIds: string[];
}

export function ClimateChart({
  series,
  deviceActions,
  mode,
  selectedDeviceIds,
}: ClimateChartProps) {
  const data = useMemo(() => mergeSeriesIntoTimeline(series), [series]);

  const visibleActions = useMemo(
    () =>
      selectedDeviceIds.length > 0
        ? deviceActions.filter((e) => selectedDeviceIds.includes(e.deviceId))
        : deviceActions,
    [deviceActions, selectedDeviceIds],
  );

  // Map timestamp → list of events for fast tooltip lookup
  const deviceEventsByTs = useMemo(() => {
    const m = new Map<number, DeviceActionEvent[]>();
    for (const e of visibleActions) {
      const ts = new Date(e.recordedAt).getTime();
      if (!m.has(ts)) m.set(ts, []);
      m.get(ts)!.push(e);
    }
    return m;
  }, [visibleActions]);

  const deviceColorMap = useMemo(() => {
    const allDeviceIds = [...new Set(deviceActions.map((e) => e.deviceId))];
    return new Map(allDeviceIds.map((id, i) => [id, DEVICE_COLORS[i % DEVICE_COLORS.length]]));
  }, [deviceActions]);

  if (data.length === 0) {
    return (
      <div style={emptyStyle}>
        No data for the selected rooms and time range.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={420}>
      <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
        <XAxis
          dataKey="ts"
          type="number"
          scale="time"
          domain={["auto", "auto"]}
          tickFormatter={formatAxisTime}
          tick={{ fontSize: 11, fill: "#aaa" }}
          tickCount={8}
        />
        <YAxis
          yAxisId="main"
          orientation="left"
          domain={mode === "humidity" ? [0, 100] : ["auto", "auto"]}
          tick={{ fontSize: 11, fill: "#aaa" }}
          label={{
            value: mode === "temperature" ? "°C" : "%",
            angle: -90,
            position: "insideLeft",
            fill: "#aaa",
            fontSize: 12,
          }}
        />

        <Tooltip
          content={<CustomTooltip deviceEvents={deviceEventsByTs} />}
          labelFormatter={formatTimestamp}
        />
        <Legend wrapperStyle={{ color: "#ccc", fontSize: 12 }} />

        {/* Lines for the active mode */}
        {series.map((room, i) =>
          mode === "temperature" ? (
            <Line
              key={`${room.roomId}_temp`}
              yAxisId="main"
              type="monotone"
              dataKey={`${room.roomId}_temp`}
              name={`${room.roomName} (°C)`}
              stroke={ROOM_COLORS[i % ROOM_COLORS.length]}
              dot={false}
              strokeWidth={2}
              connectNulls={false}
            />
          ) : (
            <Line
              key={`${room.roomId}_hum`}
              yAxisId="main"
              type="monotone"
              dataKey={`${room.roomId}_hum`}
              name={`${room.roomName} (RH%)`}
              stroke={ROOM_COLORS[i % ROOM_COLORS.length]}
              dot={false}
              strokeWidth={2}
              connectNulls={false}
            />
          ),
        )}

        {/* Device action reference lines */}
        {visibleActions.map((e, i) => (
          <ReferenceLine
            key={`action-${i}`}
            yAxisId="main"
            x={new Date(e.recordedAt).getTime()}
            stroke={deviceColorMap.get(e.deviceId) ?? "#888"}
            strokeDasharray="3 3"
            strokeWidth={1}
            strokeOpacity={0.6}
          />
        ))}

        <Brush
          dataKey="ts"
          tickFormatter={formatAxisTime}
          height={24}
          stroke="#444"
          fill="#0f0f1e"
          travellerWidth={8}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

const emptyStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: 420,
  color: "#666",
  fontSize: 14,
};
