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

const PAGE_STYLE = `
  html, body {
    background: #ffffff;
    color: #1f2328;
    margin: 0;
    padding: 0;
  }
  .home-info-page {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      Helvetica, Arial, sans-serif;
    line-height: 1.6;
    max-width: 46rem;
    margin: 0 auto;
    padding: 2.5rem 1.5rem;
  }
  .home-info-page h1,
  .home-info-page h2,
  .home-info-page h3,
  .home-info-page h4,
  .home-info-page h5,
  .home-info-page h6 {
    line-height: 1.25;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }
  .home-info-page p,
  .home-info-page ul,
  .home-info-page ol,
  .home-info-page blockquote,
  .home-info-page table {
    margin-top: 0;
    margin-bottom: 1em;
  }
  .home-info-page img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
  }
  .home-info-page code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    background: #f2f2f5;
    padding: 0.15em 0.4em;
    border-radius: 4px;
  }
  .home-info-page pre code {
    display: block;
    padding: 1em;
    overflow-x: auto;
  }
  .home-info-page blockquote {
    margin-left: 0;
    padding-left: 1em;
    border-left: 4px solid #d0d7de;
    color: #57606a;
  }
  .home-info-page a {
    color: #0969da;
  }
  @media (prefers-color-scheme: dark) {
    html, body {
      background: #0d1117;
      color: #e6edf3;
    }
    .home-info-page code {
      background: #21262d;
    }
    .home-info-page blockquote {
      border-left-color: #30363d;
      color: #8b949e;
    }
    .home-info-page a {
      color: #4493f8;
    }
  }
`;

function HomeInfoPageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{PAGE_STYLE}</style>
      <div className="home-info-page">{children}</div>
    </>
  );
}

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
    return (
      <HomeInfoPageShell>
        <p>Loading...</p>
      </HomeInfoPageShell>
    );
  }
  if (state.status === "forbidden") {
    return (
      <HomeInfoPageShell>
        <p>You don't have access to view this page.</p>
      </HomeInfoPageShell>
    );
  }
  if (state.status === "not-found") {
    return (
      <HomeInfoPageShell>
        <p>This page could not be found.</p>
      </HomeInfoPageShell>
    );
  }
  if (state.status === "error") {
    return (
      <HomeInfoPageShell>
        <p>Failed to load this page.</p>
      </HomeInfoPageShell>
    );
  }

  return (
    <HomeInfoPageShell>
      <div dangerouslySetInnerHTML={{ __html: state.html }} />
    </HomeInfoPageShell>
  );
}
