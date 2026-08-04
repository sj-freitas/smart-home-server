import { useEffect, useState } from "react";
import { marked } from "marked";
import { useAuthentication } from "./auth/use-auth";

type LoadState =
  | { status: "loading" }
  | { status: "needs-login" }
  | { status: "forbidden" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; html: string };

export default function HomeInfoPage({ homeId }: { homeId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const { startLogin } = useAuthentication();
  const API_BASE = import.meta.env.VITE_API_HOSTNAME;

  useEffect(() => {
    fetch(`${API_BASE}/home-info/${encodeURIComponent(homeId)}`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (res.status === 401) {
          setState({ status: "needs-login" });
          return;
        }
        if (res.status === 403) {
          setState({ status: "forbidden" });
          return;
        }
        if (res.status === 404) {
          setState({ status: "not-found" });
          return;
        }
        if (!res.ok) {
          setState({ status: "error" });
          return;
        }

        const data = await res.json();
        const html = await marked.parse(data.markdown);
        setState({ status: "ready", html });
      })
      .catch((err) => {
        console.error(err);
        setState({ status: "error" });
      });
  }, [API_BASE, homeId]);

  useEffect(() => {
    if (state.status === "needs-login") {
      startLogin();
    }
  }, [state.status, startLogin]);

  if (state.status === "loading" || state.status === "needs-login") {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }
  if (state.status === "forbidden") {
    return (
      <div style={{ padding: 20 }}>
        You don't have access to view this page.
      </div>
    );
  }
  if (state.status === "not-found") {
    return <div style={{ padding: 20 }}>This page could not be found.</div>;
  }
  if (state.status === "error") {
    return <div style={{ padding: 20 }}>Failed to load this page.</div>;
  }

  return (
    <div
      className="app-shell markdown-content"
      dangerouslySetInnerHTML={{ __html: state.html }}
    />
  );
}
