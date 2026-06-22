import {
  ClimateResponse,
  DeviceActionsResponse,
  HomeState,
  Granularity,
} from "../types";

const API_BASE = import.meta.env.VITE_API_HOSTNAME;

function toISOString(date: Date): string {
  return date.toISOString();
}

function buildQuery(params: Record<string, string | string[] | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export async function fetchClimateMetrics(opts: {
  roomIds?: string[];
  from?: Date;
  to?: Date;
  granularity?: Granularity;
}): Promise<ClimateResponse> {
  const qs = buildQuery({
    roomIds: opts.roomIds,
    from: opts.from ? toISOString(opts.from) : undefined,
    to: opts.to ? toISOString(opts.to) : undefined,
    granularity: opts.granularity,
  });

  const res = await fetch(`${API_BASE}/api/metrics/climate${qs}`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Climate metrics fetch failed: ${res.status}`);
  }

  return res.json() as Promise<ClimateResponse>;
}

export async function fetchDeviceActions(opts: {
  roomIds?: string[];
  deviceIds?: string[];
  from?: Date;
  to?: Date;
}): Promise<DeviceActionsResponse> {
  const qs = buildQuery({
    roomIds: opts.roomIds,
    deviceIds: opts.deviceIds,
    from: opts.from ? toISOString(opts.from) : undefined,
    to: opts.to ? toISOString(opts.to) : undefined,
  });

  const res = await fetch(`${API_BASE}/api/metrics/actions${qs}`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Device actions fetch failed: ${res.status}`);
  }

  return res.json() as Promise<DeviceActionsResponse>;
}

export async function fetchHomeState(): Promise<HomeState> {
  const res = await fetch(`${API_BASE}/api/home`, { credentials: "include" });

  if (!res.ok) {
    throw new Error(`Home state fetch failed: ${res.status}`);
  }

  return res.json() as Promise<HomeState>;
}
