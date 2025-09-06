import { useEffect, useState } from "react";

export default function App() {
  const [msg, setMsg] = useState("loading...");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/hello/")
      .then(r => r.json())
      .then(d => setMsg(d.message))
      .catch(() => setMsg("API error"));
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-4">Frontend + Backend Test</h1>
      <p className="text-lg">Django says: {msg}</p>
      <button
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={() => alert("Tailwind works!")}
      >
        Click me
      </button>
    </div>
  );
}
