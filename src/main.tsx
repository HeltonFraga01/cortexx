import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./App.css";

// Inicializar configurações de ambiente
import { validateEnvironment, logEnvironmentInfo } from "./config/environment";

// Validar e logar configurações de ambiente
validateEnvironment();
logEnvironmentInfo();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
