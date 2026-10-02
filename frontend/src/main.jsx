import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import Header from "./components/Header"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <div className="app-shell">
          <Header />
            <main className="main-content">
              <App />
            </main>
          </div>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
