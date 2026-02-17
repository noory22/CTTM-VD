import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import "./index.css";
// import Login from "./Login.jsx";
import MainMenu from "./MainMenu.jsx";
import CreateConfig from "./CreateConfig.jsx"; // Add this import
import HandleConfig from "./HandleConfig.jsx";
import Manual from "./Manual.jsx";
import ProcessLogs from "./ProcessLogs.jsx";
import ProcessMode from "./ProcessMode.jsx"; // add this import

import SafetyAlert from "./SafetyAlert.jsx";

// Check if serialAPI is available
console.log('Renderer loaded, serialAPI available:', !!window.serialAPI);

const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <HashRouter>
      <SafetyAlert>
        <Routes>
          {/* <Route path="/" element={<Login />} /> */}
          <Route path="/" element={<MainMenu />} />
          <Route path="/create-config" element={<CreateConfig />} /> {/* Add this route */}
          <Route path="/handle-config/load" element={<HandleConfig mode="load" />} />
          <Route path="/handle-config/delete" element={<HandleConfig mode="delete" />} />
          <Route path="/manual-mode" element={<Manual />} />
          <Route path="/process-logs" element={<ProcessLogs />} />
          <Route path="/process-mode" element={<ProcessMode />} />
        </Routes>
      </SafetyAlert>
    </HashRouter>
  </React.StrictMode>
);
