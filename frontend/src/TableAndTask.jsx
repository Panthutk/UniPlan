import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function authGet(path, token) {
    const r = await fetch(`${BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
    });
    if (!r.ok) throw new Error(`GET ${path} failed (${r.status})`);
    return r.json();
}

function normalizeCourses(json) {
    return Array.isArray(json) ? json : (json?.courses || []);
}
function normalizeSubmissions(json) {
    return Array.isArray(json) ? json : (json?.studentSubmissions || []);
}
function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return isNaN(d) ? "—" : d.toLocaleString();
}

export default function TableAndTask() {
    const nav = useNavigate();
    const token = localStorage.getItem("jwt");
    const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "null"), []);

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);

    const [courses, setCourses] = useState([]);           // ACTIVE courses
    const [subsByCourse, setSubsByCourse] = useState({}); // { [courseId]: StudentSubmission[] }
    const [showRaw, setShowRaw] = useState(false);

    useEffect(() => {
        if (!token) { nav("/login"); return; }

        (async () => {
            try {
                setLoading(true);
                setErr(null);

                // 1) ACTIVE courses
                const coursesJson = await authGet("/api/classroom/courses", token);
                const active = normalizeCourses(coursesJson).filter(
                    c => (c.courseState || c.state || "ACTIVE") === "ACTIVE"
                );
                setCourses(active);

                // 2) Active submissions for each course
                const results = await Promise.allSettled(
                    active.map(async (c) => {
                        const id = c.id || c.courseId;
                        const sj = await authGet(`/api/classroom/active-submissions/${encodeURIComponent(id)}`, token);
                        return { id, list: normalizeSubmissions(sj) };
                    })
                );
                const byId = {};
                for (const r of results) if (r.status === "fulfilled") byId[r.value.id] = r.value.list;
                setSubsByCourse(byId);
            } catch (e) {
                console.error(e);
                setErr(String(e));
            } finally {
                setLoading(false);
            }
        })();
    }, [token, nav]);

    if (!token) return null;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <div className="font-semibold">Logged in as {user?.name || user?.email}</div>
                    <div className="opacity-70 text-sm">{user?.email}</div>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            className="accent-current"
                            checked={showRaw}
                            onChange={(e) => setShowRaw(e.target.checked)}
                        />
                        Show raw JSON
                    </label>
                    <button
                        className="border rounded-lg px-3 py-2"
                        onClick={() => { localStorage.clear(); nav("/login"); }}
                    >
                        Logout
                    </button>
                </div>
            </div>

            {/* Status */}
            {loading && <div className="text-sm opacity-70">Loading active classes & active assignments…</div>}
            {err && <div className="text-sm text-red-400">Error: {err}</div>}

            {/* Active classes + Active assignments */}
            <section>
                <h2 className="text-xl font-semibold mb-2">Active Classes</h2>
                {!loading && courses.length === 0 && (
                    <div className="text-sm opacity-70">No active classes found.</div>
                )}

                <div className="space-y-4">
                    {courses.map((c) => {
                        const id = c.id || c.courseId;
                        // newest updated first
                        const subs = (subsByCourse[id] || []).slice().sort((a, b) => {
                            const ta = Date.parse(a.updateTime || a.creationTime || 0);
                            const tb = Date.parse(b.updateTime || b.creationTime || 0);
                            return (tb || 0) - (ta || 0);
                        });

                        return (
                            <div key={id} className="rounded-xl border border-white/10 p-4 bg-black/5">
                                <div className="flex items-baseline justify-between">
                                    <div className="font-medium">
                                        {c.name} {c.section ? <span className="opacity-70">({c.section})</span> : null}
                                    </div>
                                    <div className="text-xs opacity-70">Course ID: {id}</div>
                                </div>

                                <div className="mt-3">
                                    <div className="text-sm font-semibold mb-2">
                                        Active Assignments ({subs.length})
                                    </div>

                                    {subs.length === 0 ? (
                                        <div className="text-sm opacity-70">No active assignments.</div>
                                    ) : (
                                        <ul className="space-y-2">
                                            {subs.map((s) => (
                                                <li key={s.id} className="rounded-lg border border-white/10 p-3 bg-white/5">
                                                    <div className="font-medium">
                                                        #{s.courseWorkId} · {s.courseWorkType || "CourseWork"}
                                                    </div>
                                                    <div className="text-xs opacity-70">
                                                        State: {s.state} · Late: {String(s.late)} ·
                                                        Created: {fmtDate(s.creationTime)} · Updated: {fmtDate(s.updateTime)}
                                                    </div>
                                                    {s.alternateLink && (
                                                        <a
                                                            className="text-xs underline"
                                                            href={s.alternateLink}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            Open in Classroom
                                                        </a>
                                                    )}
                                                    {showRaw && (
                                                        <pre className="mt-2 text-xs bg-black/10 p-2 rounded overflow-auto">
                                                            {JSON.stringify(s, null, 2)}
                                                        </pre>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                {showRaw && (
                                    <details className="mt-3">
                                        <summary className="cursor-pointer text-xs opacity-70">Course raw JSON</summary>
                                        <pre className="mt-2 text-xs bg-black/10 p-3 rounded overflow-auto">
                                            {JSON.stringify(c, null, 2)}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
