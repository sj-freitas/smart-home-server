import "./styles.css";
import React from "react";
import { createRoot } from "react-dom/client";
import Application from "./application";
import HomeInfoPage from "./home-info-page";

function renderRoute() {
  const homeInfoMatch = window.location.pathname.match(
    /^\/home-info\/([^/]+)\/?$/,
  );
  if (homeInfoMatch) {
    return <HomeInfoPage homeId={decodeURIComponent(homeInfoMatch[1])} />;
  }
  return <Application />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{renderRoute()}</React.StrictMode>,
);
