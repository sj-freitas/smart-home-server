import { useEffect, useState } from "react";
import { DeviceActionEvent } from "../types";
import { fetchDeviceActions } from "../api/metrics-api";

export interface UseDeviceActionsResult {
  events: DeviceActionEvent[];
  loading: boolean;
  error: string | null;
}

export function useDeviceActions(opts: {
  roomIds: string[];
  deviceIds?: string[];
  from: Date;
  to: Date;
}): UseDeviceActionsResult {
  const [events, setEvents] = useState<DeviceActionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { roomIds, deviceIds, from, to } = opts;

  useEffect(() => {
    if (roomIds.length === 0) {
      setEvents([]);
      return;
    }

    setLoading(true);
    setError(null);

    fetchDeviceActions({ roomIds, deviceIds, from, to })
      .then((res) => {
        setEvents(res.events);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [roomIds.join(","), (deviceIds ?? []).join(","), from.getTime(), to.getTime()]);

  return { events, loading, error };
}
