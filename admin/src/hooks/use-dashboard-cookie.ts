import { Granularity, TimePreset } from "../types";

const COOKIE_NAME = "admin_dashboard_v1";
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;

export interface StoredDashboardSettings {
  preset?: string;
  granularity?: string;
  mode?: string;
  customFrom?: string;
  customTo?: string;
  selectedRoomIds?: string[];
  selectedDeviceIds?: string[];
}

export function readDashboardCookie(): StoredDashboardSettings {
  try {
    const entry = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${COOKIE_NAME}=`));
    if (!entry) return {};
    return JSON.parse(decodeURIComponent(entry.slice(COOKIE_NAME.length + 1)));
  } catch {
    return {};
  }
}

export function writeDashboardCookie(settings: StoredDashboardSettings): void {
  const encoded = encodeURIComponent(JSON.stringify(settings));
  document.cookie = `${COOKIE_NAME}=${encoded}; max-age=${COOKIE_MAX_AGE_S}; path=/; SameSite=Lax`;
}

const VALID_PRESETS: TimePreset[] = ["1h", "6h", "24h", "7d", "30d", "custom"];
const VALID_GRANULARITIES: Granularity[] = [
  "raw",
  "minute",
  "hour",
  "day",
  "week",
  "month",
];

export function savedPreset(saved: StoredDashboardSettings): TimePreset {
  return VALID_PRESETS.includes(saved.preset as TimePreset)
    ? (saved.preset as TimePreset)
    : "24h";
}

export function savedGranularity(
  saved: StoredDashboardSettings,
  fallback: Granularity,
): Granularity {
  return VALID_GRANULARITIES.includes(saved.granularity as Granularity)
    ? (saved.granularity as Granularity)
    : fallback;
}

export function savedMode(
  saved: StoredDashboardSettings,
): "temperature" | "humidity" {
  return saved.mode === "humidity" ? "humidity" : "temperature";
}

export function savedRoomIds(saved: StoredDashboardSettings): string[] {
  return Array.isArray(saved.selectedRoomIds) ? saved.selectedRoomIds : [];
}

export function savedDeviceIds(saved: StoredDashboardSettings): string[] {
  return Array.isArray(saved.selectedDeviceIds) ? saved.selectedDeviceIds : [];
}
