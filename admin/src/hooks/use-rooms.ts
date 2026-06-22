import { useEffect, useState } from "react";
import { HomeState, RoomState } from "../types";
import { fetchHomeState } from "../api/metrics-api";

export interface UseRoomsResult {
  rooms: RoomState[];
  loading: boolean;
  error: string | null;
}

export function useRooms(): UseRoomsResult {
  const [rooms, setRooms] = useState<RoomState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchHomeState()
      .then((state: HomeState | null) => {
        setRooms(state?.rooms ?? []);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  return { rooms, loading, error };
}
