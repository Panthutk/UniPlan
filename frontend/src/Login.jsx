import React, { useEffect } from "react";
import Button from "@mui/material/Button";
import GoogleIcon from "@mui/icons-material/Google";
import { Link, NavLink, useNavigate } from "react-router-dom";

const auth = {
  get token() { return localStorage.getItem("jwt"); },
  set token(v) { v ? localStorage.setItem("jwt", v) : localStorage.removeItem("jwt"); },
  get user() { try { return JSON.parse(localStorage.getItem("user")); } catch { return null; } },
  set user(v) { v ? localStorage.setItem("user", JSON.stringify(v)) : localStorage.removeItem("user"); }
};

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function getGoogleAuthUrl() {
  const r = await fetch(`${BASE_URL}/api/auth/google/login`);
  if (!r.ok) throw new Error("Failed to get Google auth URL");
  return r.json(); // { auth_url }
}

export default function Login() {
  const navigate = useNavigate();

  // If we arrive with ?token=..., store and continue
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const token = qs.get("token");
    if (token) {
      const user = {
        email: qs.get("email"),
        name: qs.get("name"),
        picture: qs.get("picture"),
      };
      auth.token = token;
      auth.user = user;
      // Clean the URL so the params don't linger
      window.history.replaceState({}, "", "/login");
      navigate("/tableandtask", { replace: true });
    }
  }, [navigate]);

  const onGoogleClick = async () => {
    try {
      const { auth_url } = await getGoogleAuthUrl();
      window.location.href = auth_url;
    } catch (e) {
      console.error(e);
      alert("Failed to start Google sign-in.");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      <header className="fixed top-0 inset-x-0 z-50 bg-zinc-900/70 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="font-black tracking-wide text-3xl sm:text-4xl">LOGO</Link>
            <nav className="flex items-center gap-3">
              <NavLink
                to="/about"
                className={({ isActive }) =>
                  `rounded-md border border-white/15 px-3 py-1.5 text-sm ${isActive ? "bg-white/10 text-white" : "text-zinc-200 hover:bg-white/5"
                  }`
                }
              >
                About us
              </NavLink>
            </nav>
          </div>
        </div>
      </header>

      <main className="pt-28">
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-12 items-center">
            <div className="lg:col-span-7">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-tight">
                <span className="text-white/90">UniPlan</span>
              </h1>
              <p className="mt-6 max-w-2xl text-zinc-300 text-lg">
                One timetable to rule your classes <span className="text-zinc-400">and</span> tasks.
                Plan faster, stay organized, never miss a deadline.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button
                  aria-label="Start with Google"
                  onClick={onGoogleClick}
                  variant="contained"
                  startIcon={<GoogleIcon />}
                  sx={{ bgcolor: "#2a8d5c", px: 3, py: 1.25, borderRadius: 2, "&:hover": { bgcolor: "#246042" } }}
                >
                  Start with Google
                </Button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <FeatureCard title="Interactive Timetable" desc="Add, drop, and arrange classes in a weekly view." />
                <FeatureCard title="Linked Tasks" desc="Create homework directly from a class block." />
                <FeatureCard title="Classroom Sync" desc="Pull subjects & assignments from Google Classroom." />
                <FeatureCard title="Reminders" desc="Get notified before due dates so you never miss one." />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-24 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 text-sm text-zinc-400">
          © {new Date().getFullYear()} UniPlan · All rights reserved
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ title, desc }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-800/60 p-5 hover:bg-zinc-800/80 transition">
      <h3 className="font-semibold text-zinc-100">{title}</h3>
      <p className="mt-2 text-sm text-zinc-300">{desc}</p>
    </div>
  );
}
