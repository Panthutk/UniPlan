import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// frontend/lib/utils.js
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export async function getGoogleAuthUrl() {
  const r = await fetch(`${BASE_URL}/api/auth/google/login`);
  if (!r.ok) throw new Error("Failed to get Google auth URL");
  return r.json(); // { auth_url }
}

export async function exchangeCode(code) {
  const url = new URL(`${BASE_URL}/api/auth/google/callback`);
  url.searchParams.set("code", code);
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json(); // { token, user }
}

export async function authGet(path, token) {
  const r = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!r.ok) throw new Error(`GET ${path} failed`);
  return r.json();
}
