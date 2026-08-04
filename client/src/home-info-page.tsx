import { useEffect, useState } from "react";
import { marked } from "marked";
import { useAuthentication } from "./auth/use-auth";

type LoadState =
  | { status: "loading" }
  | { status: "needs-login" }
  | { status: "forbidden" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; html: string; bannerUrl: string | null };

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
    font-weight: 600;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }
  .home-info-page h1 {
    font-size: 2em;
  }
  .home-info-page h2 {
    font-size: 1.5em;
  }
  .home-info-page h3 {
    font-size: 1.25em;
  }
  .home-info-page h4 {
    font-size: 1em;
  }
  .home-info-page h5 {
    font-size: 0.875em;
  }
  .home-info-page h6 {
    font-size: 0.85em;
  }
  .home-info-page p,
  .home-info-page ul,
  .home-info-page ol,
  .home-info-page blockquote,
  .home-info-page table {
    margin-top: 0;
    margin-bottom: 1em;
  }
  .home-info-page > div > :first-child {
    margin-top: 0;
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
  .home-info-banner {
    width: 100%;
    /* Extend up behind the iPhone notch / Dynamic Island instead of being
       pushed down below it (requires viewport-fit=cover in index.html). */
    height: calc(280px + env(safe-area-inset-top, 0px));
    overflow: hidden;
  }
  .home-info-banner img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
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

function HomeInfoPageShell({
  bannerUrl,
  children,
}: {
  bannerUrl?: string | null;
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{PAGE_STYLE}</style>
      {bannerUrl && (
        <div className="home-info-banner">
          <img src={bannerUrl} alt="Home banner" />
        </div>
      )}
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
        setState({ status: "ready", html, bannerUrl: data.bannerUrl ?? null });
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
    <HomeInfoPageShell bannerUrl={state.bannerUrl}>
      <div dangerouslySetInnerHTML={{ __html: state.html }} />
    </HomeInfoPageShell>
  );
}
