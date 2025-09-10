import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./Login.jsx";
import About from "./about.jsx";
import TableAndTask from "./TableAndTask.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/about" element={<About />} />
        <Route path="/tableandtask" element={<TableAndTask />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
