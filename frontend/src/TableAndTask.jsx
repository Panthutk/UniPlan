import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function authGet(path, token) {
    const r = await fetch(`${BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
    });
    if (!r.ok) throw new Error(`GET ${path} failed`);
    return r.json();
}

export default function TableAndTask() {
    const nav = useNavigate();
    const token = localStorage.getItem("jwt");
    const user = JSON.parse(localStorage.getItem("user") || "null");
    const [courses, setCourses] = useState(null);
    const [summary, setSummary] = useState(null);

    useEffect(() => {
        if (!token) { nav("/login"); return; }
        (async () => {
            try {
                const c = await authGet("/api/classroom/courses", token);
                const s = await authGet("/api/classroom/summary", token);
                setCourses(c);
                setSummary(s);
            } catch (e) { console.error(e); }
        })();
    }, [token, nav]);

    if (!token) return null;

    return (
        <div className="p-6 space-y-6 text-sm">
            <div className="flex justify-between items-center">
                <div>
                    <div className="font-semibold">Logged in as {user?.name || user?.email}</div>
                    <div className="opacity-70">{user?.email}</div>
                </div>
                <button
                    className="border rounded-lg px-3 py-2"
                    onClick={() => { localStorage.clear(); nav("/login"); }}
                >
                    Logout
                </button>
            </div>

            <h2 className="text-xl font-semibold">/api/classroom/courses</h2>
            <pre className="bg-black/5 p-4 rounded-xl overflow-auto">{JSON.stringify(courses, null, 2)}</pre>

            <h2 className="text-xl font-semibold">/api/classroom/summary</h2>
            <pre className="bg-black/5 p-4 rounded-xl overflow-auto">{JSON.stringify(summary, null, 2)}</pre>
        </div>
    );
}
