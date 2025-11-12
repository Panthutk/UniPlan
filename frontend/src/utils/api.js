export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
export const API = BASE_URL;

export const authHeader = () => {
    const t = localStorage.getItem("jwt");
    return t ? { Authorization: `Bearer ${t}` } : {};
};

export async function get(path) {
    const r = await fetch(`${API}${path}`, {
        credentials: "include",
        headers: { ...authHeader() },
    });
    if (!r.ok)
        throw new Error(`GET ${path} failed (${r.status}): ${await r.text().catch(() => "")}`);
    return r.json();
}

export async function post(path, body) {
    const r = await fetch(`${API}${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(body),
    });
    if (!r.ok)
        throw new Error(`POST ${path} failed (${r.status}): ${await r.text().catch(() => "")}`);
    return r.json();
}

export async function patch(path, body) {
    const r = await fetch(`${API}${path}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`PATCH ${path} failed (${r.status})`);
    return r.json();
}

export async function del(path) {
    const r = await fetch(`${API}${path}`, {
        method: "DELETE",
        credentials: "include",
        headers: { ...authHeader() },
    });
    if (!r.ok && r.status !== 204)
        throw new Error(`DELETE ${path} failed (${r.status})`);
}

// Timetable list + subjects (used after import to refresh UI)
export async function listTimetable() {
  return get(`/api/timetable/?ordering=day_of_week,start_time`);
}
export async function listSubjects() {
  return get(`/api/subjects/`);
}

// EXPORT: GET /api/timetable/export.csv -> download file
export async function exportTimetableCSV() {
  const candidates = [
    "/api/timetable/export.csv",
    "/api/timetable/export/?format=csv",
    "/api/timetable/export/",
    "/api/timetable/export",        // <— add
    "/api/timetable/csv/",          // <— add
  ];

  let resp = null;
  for (const path of candidates) {
    const r = await fetch(`${API}${path}`, {
      method: "GET",
      credentials: "include",
      headers: { ...authHeader() },
    });
    if (r.ok) { resp = r; break; }
  }

  if (!resp) throw new Error("Export failed (no matching endpoint)");

  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "timetable.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


export async function importTimetableCSV(file) {
  const fd = new FormData();
  fd.append("file", file);

  const candidates = [
    "/api/timetable/import",
    "/api/timetable/import/",
  ];

  let resp = null, json = null, last = null;

  for (const path of candidates) {
    const r = await fetch(`${API}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { ...authHeader() }, // don't set content-type for FormData
      body: fd,
    });
    last = r;
    json = await r.json().catch(() => ({}));
    if (r.ok) { resp = r; break; }
  }

  if (!resp) {
    const msg = json?.detail || `Import failed (${last?.status ?? "?"})`;
    const errs = json?.errors?.length ? `\n\nErrors:\n- ${json.errors.join("\n- ")}` : "";
    throw new Error(msg + errs);
  }
  return json;
}

