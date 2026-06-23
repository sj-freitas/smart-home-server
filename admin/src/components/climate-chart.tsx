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
  TooltipProps,
} from "recharts";
import { ClimateSeries, DeviceActionEvent, RoomState } from "../types";

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
      if (!byTs.has(ts)) byTs.set(ts, { ts });
      const row = byTs.get(ts)!;
      if (point.temperature !== null)
        row[`${room.roomId}_temp`] = point.temperature;
      if (point.humidity !== null) row[`${room.roomId}_hum`] = point.humidity;
    }
  }

  return Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);
}

interface StepSeriesData {
  devicePath: string;
  dataKey: string;
  deviceName: string;
  color: string;
  events: Array<{ ts: number; y: number }>;
}

interface CustomTooltipPayloadEntry {
  name: string;
  value: number | null;
  color: string;
  dataKey?: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  actionAxisTicks,
}: TooltipProps<number, string> & {
  actionAxisTicks: Map<number, string>;
}) {
  if (!active || !payload?.length) return null;

  const ts = label as number;

  return (
    <div style={tooltipStyle}>
      <p style={{ margin: "0 0 4px", fontWeight: 600 }}>
        {formatTimestamp(ts)}
      </p>
      {(payload as CustomTooltipPayloadEntry[]).map((entry) => {
        const isState = entry.dataKey?.endsWith("_state") ?? false;
        const displayValue = isState
          ? (actionAxisTicks.get(Math.round(Number(entry.value))) ??
            `${entry.value}%`)
          : entry.value != null
            ? (entry.value as number).toFixed(1)
            : "—";
        return (
          <p key={entry.name} style={{ margin: "2px 0", color: entry.color }}>
            {entry.name}: {displayValue}
          </p>
        );
      })}
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
  rooms: RoomState[];
}

export function ClimateChart({
  series,
  deviceActions,
  mode,
  selectedDeviceIds,
  rooms,
}: ClimateChartProps) {
  const data = useMemo(() => mergeSeriesIntoTimeline(series), [series]);

  const visibleActions = useMemo(
    () =>
      selectedDeviceIds.length > 0
        ? deviceActions.filter((e) => selectedDeviceIds.includes(e.deviceId))
        : deviceActions,
    [deviceActions, selectedDeviceIds],
  );

  // device config lookup: "roomId/deviceId" → { deviceName, actions }
  const deviceConfigMap = useMemo(() => {
    const map = new Map<
      string,
      { deviceName: string; actions: { id: string; name: string }[] }
    >();
    for (const room of rooms) {
      for (const device of room.devices) {
        map.set(`${room.id}/${device.id}`, {
          deviceName: device.name,
          actions: device.actions,
        });
      }
    }
    return map;
  }, [rooms]);

  // Per-device step series: sorted event timestamps + normalised Y values
  const stepSeries = useMemo((): StepSeriesData[] => {
    if (rooms.length === 0 || visibleActions.length === 0) return [];

    const eventsByDevice = new Map<string, DeviceActionEvent[]>();
    for (const event of visibleActions) {
      const path = `${event.roomId}/${event.deviceId}`;
      if (!eventsByDevice.has(path)) eventsByDevice.set(path, []);
      eventsByDevice.get(path)!.push(event);
    }

    const result: StepSeriesData[] = [];
    let colorIdx = 0;

    for (const [devicePath, events] of eventsByDevice) {
      const config = deviceConfigMap.get(devicePath);
      if (!config || config.actions.length === 0) continue;

      const { actions } = config;
      const sorted = [...events].sort(
        (a, b) =>
          new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
      );

      // "off" action is always pinned to Y=0 (bottom); remaining actions fill up evenly
      const orderedActions = [
        ...actions.filter((a) => a.id === "off"),
        ...actions.filter((a) => a.id !== "off"),
      ];

      const stepEvents = sorted
        .map((event) => {
          const idx = orderedActions.findIndex((a) => a.id === event.actionId);
          if (idx < 0) return null;
          const y =
            orderedActions.length === 1
              ? 50
              : Math.round((idx / (orderedActions.length - 1)) * 100);
          return { ts: new Date(event.recordedAt).getTime(), y };
        })
        .filter((d): d is { ts: number; y: number } => d !== null);

      if (stepEvents.length > 0) {
        result.push({
          devicePath,
          dataKey: `${devicePath.replace("/", "__")}_state`,
          deviceName: config.deviceName,
          color: DEVICE_COLORS[colorIdx++ % DEVICE_COLORS.length],
          events: stepEvents,
        });
      }
    }

    return result;
  }, [visibleActions, deviceConfigMap, rooms.length]);

  // Extend climate data points with carry-forward device state values
  const extendedData = useMemo((): MergedDataPoint[] => {
    if (stepSeries.length === 0) return data;
    return data.map((point) => {
      const ext: MergedDataPoint = { ...point };
      for (const { dataKey, events: stepEvents } of stepSeries) {
        const last = stepEvents.findLast((e) => e.ts <= point.ts);
        ext[dataKey] = last?.y ?? null;
      }
      return ext;
    });
  }, [data, stepSeries]);

  // Y-axis ticks for device action labels (rounded Y → label)
  // Uses the same "off pinned to 0" ordering as stepSeries computation
  const actionAxisTicks = useMemo(() => {
    const tickMap = new Map<number, string>();
    for (const { devicePath } of stepSeries) {
      const config = deviceConfigMap.get(devicePath);
      if (!config) continue;
      const orderedActions = [
        ...config.actions.filter((a) => a.id === "off"),
        ...config.actions.filter((a) => a.id !== "off"),
      ];
      orderedActions.forEach((action, idx) => {
        const y =
          orderedActions.length === 1
            ? 50
            : Math.round((idx / (orderedActions.length - 1)) * 100);
        const existing = tickMap.get(y);
        if (!existing) {
          tickMap.set(y, action.name);
        } else if (!existing.split("/").includes(action.name)) {
          tickMap.set(y, `${existing}/${action.name}`);
        }
      });
    }
    return tickMap;
  }, [stepSeries, deviceConfigMap]);

  const sortedActionTicks = useMemo(
    () => [...actionAxisTicks.keys()].sort((a, b) => a - b),
    [actionAxisTicks],
  );

  if (data.length === 0) {
    return (
      <div style={emptyStyle}>
        No data for the selected rooms and time range.
      </div>
    );
  }

  const hasSteps = stepSeries.length > 0;

  return (
    <ResponsiveContainer width="100%" height={420}>
      <ComposedChart
        data={extendedData}
        margin={{ top: 10, right: hasSteps ? 90 : 30, left: 0, bottom: 0 }}
      >
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
        {hasSteps && (
          <YAxis
            yAxisId="actions"
            orientation="right"
            domain={[0, 100]}
            ticks={sortedActionTicks}
            tickFormatter={(v) =>
              actionAxisTicks.get(Math.round(Number(v))) ?? ""
            }
            tick={{ fontSize: 10, fill: "#888" }}
            width={75}
          />
        )}

        <Tooltip
          content={<CustomTooltip actionAxisTicks={actionAxisTicks} />}
          labelFormatter={formatTimestamp}
        />
        <Legend wrapperStyle={{ color: "#ccc", fontSize: 12 }} />

        {/* Climate lines */}
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
              connectNulls={true}
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
              connectNulls={true}
            />
          ),
        )}

        {/* Device state step lines */}
        {stepSeries.map(({ devicePath, dataKey, deviceName, color }) => (
          <Line
            key={`step-${devicePath}`}
            yAxisId="actions"
            type="stepAfter"
            dataKey={dataKey}
            name={`${deviceName} (state)`}
            stroke={color}
            strokeWidth={1.5}
            dot={{ r: 3, fill: color }}
            isAnimationActive={false}
            connectNulls={false}
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
