import { useState, useEffect } from "react";
import Button from "@mui/material/Button"; // MUI
import { Button as ShadButton } from "./components/ui/button"; // shadcn

export default function App() {
  const [msg, setMsg] = useState("loading...");

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

      {/* Tailwind button */}
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={() => alert("Tailwind works!")}
      >
        Tailwind Button
      </button>

      {/* MUI button */}
      <Button variant="contained" color="primary" onClick={() => alert("MUI works!")}>
        MUI Button
      </Button>

      {/* shadcn button */}
      <ShadButton onClick={() => alert("shadcn works!")}>Shadcn Button</ShadButton>
    </div>
  );
}
