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
  const initPerfMonitoring = () => {
    try {
      initPerformanceMonitoring().catch(() => {
        // Silently ignore - web-vitals may not be available
      });
    } catch {
      // Silently ignore initialization errors
    }
  };
  
  // Use requestIdleCallback if available, otherwise setTimeout
  if ('requestIdleCallback' in window) {
    requestIdleCallback(initPerfMonitoring, { timeout: 2000 });
  } else {
    setTimeout(initPerfMonitoring, 0);
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
