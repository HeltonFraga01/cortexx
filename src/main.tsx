import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./App.css";

// Inicializar configurações de ambiente
import { validateEnvironment, logEnvironmentInfo } from "./config/environment";

// Performance monitoring (Task 4.1)
import { initPerformanceMonitoring } from "./lib/performance";

// Validar e logar configurações de ambiente
validateEnvironment();
logEnvironmentInfo();

// Initialize performance monitoring after hydration
if (typeof window !== 'undefined') {
  // Delay initialization to not block initial render
  requestIdleCallback?.(() => {
    initPerformanceMonitoring();
  }) || setTimeout(() => {
    initPerformanceMonitoring();
  }, 0);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
