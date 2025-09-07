import { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import { Button as ShadButton } from "./components/ui/button";
import About from "./About";

function Home() {
  const [msg, setMsg] = useState("loading...");
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/hello/")
      .then((r) => r.json())
      .then((d) => setMsg(d.message))
      .catch(() => setMsg("API error"));
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center space-y-6">
      <h1 className="text-3xl font-bold">UniPlan Frontend</h1>
      <p className="text-lg">Django says: {msg}</p>

      <button
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={() => alert("Tailwind works!")}
      >
        Tailwind Button
      </button>

      <Button variant="contained" color="primary" onClick={() => alert("MUI works!")}>
        MUI Button
      </Button>

      <ShadButton onClick={() => alert("shadcn works!")}>Shadcn Button</ShadButton>

      <button
        onClick={() => navigate("/about")}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        About Us
      </button>


    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      {/* optional 404 */}
      {/* <Route path="*" element={<div className="p-8">Not Found</div>} /> */}
    </Routes>
  );
}
