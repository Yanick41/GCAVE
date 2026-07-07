import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Providers } from "./app/providers";
import "./index.css";
import "./lib/pwaInstall"; // capture beforeinstallprompt le plus tôt possible

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
