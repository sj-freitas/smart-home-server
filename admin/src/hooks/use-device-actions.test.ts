import { renderHook, waitFor } from "@testing-library/react";
import { useDeviceActions } from "./use-device-actions";
import * as api from "../api/metrics-api";

jest.mock("../api/metrics-api");
const mockFetchActions = api.fetchDeviceActions as jest.MockedFunction<
  typeof api.fetchDeviceActions
>;

const defaultOpts = {
  roomIds: ["living-room"],
  from: new Date("2024-01-01T00:00:00Z"),
  to: new Date("2024-01-02T00:00:00Z"),
};

describe("useDeviceActions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("fetches all rooms when roomIds is empty (no room filter applied)", async () => {
    mockFetchActions.mockResolvedValue({ events: [] });
    const { result } = renderHook(() =>
      useDeviceActions({ ...defaultOpts, roomIds: [] }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchActions).toHaveBeenCalledWith(
      expect.objectContaining({ roomIds: undefined }),
    );
    expect(result.current.events).toEqual([]);
  });

  it("fetches action events and returns them", async () => {
    const fakeEvents = [
      {
        roomId: "living-room",
        roomName: "Living Room",
        deviceId: "ac-1",
        actionId: "cool-21",
        recordedAt: "2024-01-01T14:00:00Z",
      },
    ];
    mockFetchActions.mockResolvedValue({ events: fakeEvents });

    const { result } = renderHook(() => useDeviceActions(defaultOpts));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.events).toEqual(fakeEvents);
    expect(result.current.error).toBeNull();
  });

  it("sets error when fetch fails", async () => {
    mockFetchActions.mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useDeviceActions(defaultOpts));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Server error");
  });
});
