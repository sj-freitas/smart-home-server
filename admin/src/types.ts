export interface ClimateDataPoint {
  timestamp: string;
  temperature: number | null;
  humidity: number | null;
}

export interface ClimateSeries {
  roomId: string;
  roomName: string;
  data: ClimateDataPoint[];
}

export interface ClimateResponse {
  series: ClimateSeries[];
}

export interface DeviceActionEvent {
  roomId: string;
  roomName: string;
  deviceId: string;
  actionId: string;
  recordedAt: string;
}

export interface DeviceActionsResponse {
  events: DeviceActionEvent[];
}

export interface RoomState {
  id: string;
  name: string;
  devices: { id: string; name: string }[];
}

export interface HomeState {
  name: string;
  rooms: RoomState[];
}

export type Granularity =
  | "raw"
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month";

export interface TimeRange {
  from: Date;
  to: Date;
  label: string;
}

export type TimePreset = "1h" | "6h" | "24h" | "7d" | "30d" | "custom";
