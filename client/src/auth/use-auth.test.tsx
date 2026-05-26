import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuthentication } from './use-auth';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockResponse(status: number, body: unknown = {}) {
  return Promise.resolve({
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

describe('useAuthentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets appMode to AuthFullAccess and exposes shouldRenderLogoutButton on 200', async () => {
    mockFetch.mockReturnValueOnce(mockResponse(200, { shouldRenderLogoutButton: true }));

    const { result } = renderHook(() => useAuthentication());

    await waitFor(() => expect(result.current.appMode).toBe('AuthFullAccess'));
    expect(result.current.shouldRenderLogoutButton).toBe(true);
  });

  it('sets appMode to AuthRestricted on 403', async () => {
    mockFetch.mockReturnValueOnce(mockResponse(403));

    const { result } = renderHook(() => useAuthentication());

    await waitFor(() => expect(result.current.appMode).toBe('AuthRestricted'));
    expect(result.current.shouldRenderLogoutButton).toBe(true);
  });

  it('sets appMode to NeedsLogIn on 401', async () => {
    mockFetch.mockReturnValueOnce(mockResponse(401));

    const { result } = renderHook(() => useAuthentication());

    await waitFor(() => expect(result.current.appMode).toBe('NeedsLogIn'));
    expect(result.current.shouldRenderLogoutButton).toBe(false);
  });

  it('sets appMode to AuthRestricted when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() => useAuthentication());

    await waitFor(() => expect(result.current.appMode).toBe('AuthRestricted'));
  });

  it('startLogin sets appMode to LoggingIn', async () => {
    // jsdom intercepts window.location.href navigation so we only verify the state.
    mockFetch.mockReturnValueOnce(mockResponse(200, { shouldRenderLogoutButton: false }));

    const { result } = renderHook(() => useAuthentication());

    await waitFor(() => expect(result.current.appMode).toBe('AuthFullAccess'));

    act(() => result.current.startLogin());

    expect(result.current.appMode).toBe('LoggingIn');
  });

  it('logout calls the logout endpoint', async () => {
    // 1st call: initial auth check → 200
    // 2nd call: POST /logout → 200
    // 3rd call: auth re-check triggered after appMode resets to LoggedOut → 401
    mockFetch
      .mockReturnValueOnce(mockResponse(200, { shouldRenderLogoutButton: true }))
      .mockReturnValueOnce(mockResponse(200))
      .mockReturnValueOnce(mockResponse(401));

    const { result } = renderHook(() => useAuthentication());

    await waitFor(() => expect(result.current.appMode).toBe('AuthFullAccess'));

    await act(async () => {
      await result.current.logout();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/google/logout'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
