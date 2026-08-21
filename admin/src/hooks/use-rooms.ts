import { useEffect, useState } from "react";
import { HomeState, RoomState } from "../types";
import { ApiError, fetchHomeState } from "../api/metrics-api";

export interface UseRoomsResult {
  rooms: RoomState[];
  loading: boolean;
  error: string | null;
  status: number | null;
}

export function useRooms(): UseRoomsResult {
  const [rooms, setRooms] = useState<RoomState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchHomeState()
      .then((state: HomeState | null) => {
        setRooms(state?.rooms ?? []);
        setError(null);
        setStatus(null);
      })
      .catch((err: Error) => {
        setError(err.message);
        setStatus(err instanceof ApiError ? err.status : null);
      })
      .finally(() => setLoading(false));
  }, []);

  return { rooms, loading, error, status };
}
