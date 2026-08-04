import { render, screen, waitFor } from "@testing-library/react";
import HomeInfoPage from "./home-info-page";
import { useAuthentication } from "./auth/use-auth";

jest.mock("./auth/use-auth", () => ({
  useAuthentication: jest.fn(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockStartLogin = jest.fn();

function mockResponse(status: number, body: unknown = {}) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("HomeInfoPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthentication as jest.Mock).mockReturnValue({
      appMode: "AuthFullAccess",
      shouldRenderLogoutButton: false,
      logout: jest.fn(),
      startLogin: mockStartLogin,
    });
  });

  it("shows a loading state before the fetch resolves", () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    render(<HomeInfoPage homeId="palais-freitas" />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders the fetched markdown as HTML", async () => {
    mockFetch.mockReturnValueOnce(
      mockResponse(200, { markdown: "# Welcome Home" }),
    );

    render(<HomeInfoPage homeId="palais-freitas" />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Welcome Home" }),
      ).toBeInTheDocument(),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/home-info/palais-freitas"),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("shows a not-found message on 404", async () => {
    mockFetch.mockReturnValueOnce(mockResponse(404));

    render(<HomeInfoPage homeId="palais-freitas" />);

    await waitFor(() =>
      expect(
        screen.getByText("This page could not be found."),
      ).toBeInTheDocument(),
    );
  });

  it("shows a forbidden message on 403", async () => {
    mockFetch.mockReturnValueOnce(mockResponse(403));

    render(<HomeInfoPage homeId="palais-freitas" />);

    await waitFor(() =>
      expect(
        screen.getByText("You don't have access to view this page."),
      ).toBeInTheDocument(),
    );
  });

  it("triggers login on 401", async () => {
    mockFetch.mockReturnValueOnce(mockResponse(401));

    render(<HomeInfoPage homeId="palais-freitas" />);

    await waitFor(() => expect(mockStartLogin).toHaveBeenCalled());
  });

  it("shows a generic error message on unexpected failures", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));

    render(<HomeInfoPage homeId="palais-freitas" />);

    await waitFor(() =>
      expect(screen.getByText("Failed to load this page.")).toBeInTheDocument(),
    );
  });
});
