import { renderHook, act, waitFor } from "@testing-library/react";
import { useClimateMetrics } from "./use-climate-metrics";
import * as api from "../api/metrics-api";

jest.mock("../api/metrics-api");
const mockFetchClimate = api.fetchClimateMetrics as jest.MockedFunction<
  typeof api.fetchClimateMetrics
>;

const defaultOpts = {
  roomIds: ["living-room"],
  from: new Date("2024-01-01T00:00:00Z"),
  to: new Date("2024-01-02T00:00:00Z"),
  granularity: "hour" as const,
};

describe("useClimateMetrics", () => {
  beforeEach(() => jest.clearAllMocks());

  it("fetches all rooms when roomIds is empty (no room filter applied)", async () => {
    mockFetchClimate.mockResolvedValue({ series: [] });
    const { result } = renderHook(() =>
      useClimateMetrics({ ...defaultOpts, roomIds: [] }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchClimate).toHaveBeenCalledWith(
      expect.objectContaining({ roomIds: undefined }),
    );
    expect(result.current.series).toEqual([]);
  });

  it("fetches climate data and sets series", async () => {
    const fakeSeries = [
      {
        roomId: "living-room",
        roomName: "Living Room",
        data: [
          { timestamp: "2024-01-01T00:00:00Z", temperature: 22, humidity: 45 },
        ],
      },
    ];
    mockFetchClimate.mockResolvedValue({ series: fakeSeries });

    const { result } = renderHook(() => useClimateMetrics(defaultOpts));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.series).toEqual(fakeSeries);
    expect(result.current.error).toBeNull();
  });

  it("sets error when fetch fails", async () => {
    mockFetchClimate.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useClimateMetrics(defaultOpts));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Network error");
    expect(result.current.series).toEqual([]);
  });

  it("refetch triggers a new fetch", async () => {
    mockFetchClimate.mockResolvedValue({ series: [] });

    const { result } = renderHook(() => useClimateMetrics(defaultOpts));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.refetch());

    await waitFor(() => expect(mockFetchClimate).toHaveBeenCalledTimes(2));
  });
});
