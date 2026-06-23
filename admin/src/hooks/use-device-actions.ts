import { useCallback, useEffect, useState } from "react";
import { DeviceActionEvent } from "../types";
import { fetchDeviceActions } from "../api/metrics-api";

export interface UseDeviceActionsResult {
  events: DeviceActionEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
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
  const [tick, setTick] = useState(0);

  const { roomIds, deviceIds, from, to } = opts;

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Empty roomIds = no filter (fetch all rooms).
    const activeRoomIds = roomIds.length > 0 ? roomIds : undefined;

    fetchDeviceActions({ roomIds: activeRoomIds, deviceIds, from, to })
      .then((res) => {
        setEvents(res.events);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [
    roomIds.join(","),
    (deviceIds ?? []).join(","),
    from.getTime(),
    to.getTime(),
    tick,
  ]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { events, loading, error, refetch };
}
