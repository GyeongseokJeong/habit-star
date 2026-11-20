/**
 * STEP 9 first-party guest-only runtime: reuse the actual Byeolharu UI.
 * Cloud is intentionally compiled out. This is not the release app and
 * it must never load remote WebView code or production identity data.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import Byeolharu from "../../components/byeolharu";

const root = document.getElementById("byeolharu-root");
if (!root) throw new Error("Byeolharu app root missing");
createRoot(root).render(<React.StrictMode><Byeolharu /></React.StrictMode>);
