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
