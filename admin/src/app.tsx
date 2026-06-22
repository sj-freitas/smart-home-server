import React from "react";
import { useAuth } from "./auth/use-auth";
import { Dashboard } from "./components/dashboard";

export default function App() {
  const { authState, logout } = useAuth();

  if (authState === "Checking") {
    return <FullPageMessage>Loading…</FullPageMessage>;
  }

  if (authState === "Forbidden") {
    return (
      <FullPageMessage>
        Access denied. Your account does not have permission to view this page.
      </FullPageMessage>
    );
  }

  return <Dashboard onLogout={logout} />;
}

function FullPageMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f0f1e",
        color: "#aaa",
        fontFamily: "system-ui, sans-serif",
        fontSize: 16,
      }}
    >
      {children}
    </div>
  );
}
