import { useEffect, useState } from "react";
import { ClimateSeries, Granularity } from "../types";
import { fetchClimateMetrics } from "../api/metrics-api";

export interface UseClimateMetricsResult {
  series: ClimateSeries[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useClimateMetrics(opts: {
  roomIds: string[];
  from: Date;
  to: Date;
  granularity: Granularity;
}): UseClimateMetricsResult {
  const [series, setSeries] = useState<ClimateSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const { roomIds, from, to, granularity } = opts;

  useEffect(() => {
    if (roomIds.length === 0) {
      setSeries([]);
      return;
    }

    setLoading(true);
    setError(null);

    fetchClimateMetrics({ roomIds, from, to, granularity })
      .then((res) => {
        setSeries(res.series);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [roomIds.join(","), from.getTime(), to.getTime(), granularity, tick]);

  return {
    series,
    loading,
    error,
    refetch: () => setTick((t) => t + 1),
  };
}
