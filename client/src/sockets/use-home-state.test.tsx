import { renderHook, act } from "@testing-library/react";

// Variables must be prefixed with "mock" to be allowed inside jest.mock() factories.
let mockSocketEventHandlers: Record<string, ((...args: unknown[]) => void)[]>;
let mockSocketOn: jest.Mock;
let mockSocketDisconnect: jest.Mock;

jest.mock("socket.io-client", () => ({
  io: jest.fn(() => {
    mockSocketEventHandlers = {};
    mockSocketOn = jest.fn(
      (event: string, handler: (...args: unknown[]) => void) => {
        if (!mockSocketEventHandlers[event])
          mockSocketEventHandlers[event] = [];
        mockSocketEventHandlers[event].push(handler);
      },
    );
    mockSocketDisconnect = jest.fn();
    return { on: mockSocketOn, disconnect: mockSocketDisconnect };
  }),
}));

import { useHomeState } from "./use-home-state";
import type { ServerMessage, HomeState } from "./types";

function emitEvent(event: string, ...args: unknown[]) {
  mockSocketEventHandlers[event]?.forEach((h) => h(...args));
}

describe("useHomeState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("starts with null state and disconnected", () => {
    const { result } = renderHook(() => useHomeState());
    expect(result.current.state).toBeNull();
    expect(result.current.connected).toBe(false);
  });

  it("sets connected to true when the socket emits connect", () => {
    const { result } = renderHook(() => useHomeState());
    act(() => emitEvent("connect"));
    expect(result.current.connected).toBe(true);
  });

  it("sets connected to false when the socket emits disconnect", () => {
    const { result } = renderHook(() => useHomeState());
    act(() => emitEvent("connect"));
    act(() => emitEvent("disconnect"));
    expect(result.current.connected).toBe(false);
  });

  it("updates state when the socket emits state:update", () => {
    const { result } = renderHook(() => useHomeState());

    const payload: HomeState = {
      name: "My Home",
      subTitle: "",
      logo: "",
      rooms: [],
    };
    const msg: ServerMessage<HomeState> = {
      seq: 1,
      ts: new Date().toISOString(),
      type: "snapshot",
      payload,
    };

    act(() => emitEvent("state:update", msg));
    expect(result.current.state).toEqual(payload);
  });

  it("suppresses state:update while setStateSuppressSocket is active", () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.setStateSuppressSocket(true));

    const msg: ServerMessage<HomeState> = {
      seq: 1,
      ts: new Date().toISOString(),
      type: "snapshot",
      payload: { name: "X", subTitle: "", logo: "", rooms: [] },
    };

    act(() => emitEvent("state:update", msg));
    expect(result.current.state).toBeNull();
  });

  it("disconnects the socket on unmount", () => {
    const { unmount } = renderHook(() => useHomeState());
    unmount();
    expect(mockSocketDisconnect).toHaveBeenCalled();
  });
});
