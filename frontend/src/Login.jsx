import React, { useEffect } from "react";
import Button from "@mui/material/Button";
import GoogleIcon from "@mui/icons-material/Google";
import EventIcon from "@mui/icons-material/Event";
import AssignmentIcon from "@mui/icons-material/Assignment";
import SchoolIcon from "@mui/icons-material/School";
import { Link, NavLink, useNavigate } from "react-router-dom";
import Uniplan_logo from "./assets/Uniplan_logo.svg";
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
            <img 
            src={Uniplan_logo} 
            alt="Uniplan Logo" 
            className="h-[clamp(30px,6vh,70px)] w-auto"
            />

            <nav className="flex items-center gap-3">
              {/* NEW: in-page jump link */}
              <a
                href="#whatwedo"
                className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/5"
              >
                What we do
              </a>

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
        {/* ---- HERO ---- */}
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
                {/* NEW helper link */}
                <a
                  href="#whatwedo"
                  className="text-sm text-zinc-400 hover:text-zinc-200 underline underline-offset-4"
                >
                  Learn what we do ↓
                </a>
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

        {/* ---- WHAT WE DO ---- */}
        <section
          id="whatwedo"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-28 scroll-mt-24"
        >
          {/* NEW: subtle glass container + separator for a more premium feel */}
          <div className="relative rounded-3xl border border-white/10 bg-zinc-900/40 p-6 sm:p-8 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-emerald-200 to-zinc-100">
                WHAT WE DO
              </span>
            </h2>

            {/* Top: description + bullets (full width on all screens) */}
            <div className="mt-6 sm:mt-7">
              <p className="text-zinc-300/90 leading-relaxed">
                We developed an <span className="font-semibold text-zinc-100">integrated platform</span> that
                combines task management with class timetables, designed to help students stay organized with ease.
              </p>

              {/* NEW: cleaner bullets with emerald bead markers */}
              <ul className="mt-6 space-y-3 text-zinc-300">
                <li className="relative pl-6">
                  <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-emerald-400/90 shadow-[0_0_0_3px_rgba(16,185,129,.15)]"></span>
                  Users can add, remove, and modify classes directly within the timetable.
                </li>
                <li className="relative pl-6">
                  <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-emerald-400/90 shadow-[0_0_0_3px_rgba(16,185,129,.15)]"></span>
                  Homework can be created straight from a class block on the timetable.
                </li>
                <li className="relative pl-6">
                  <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-emerald-400/90 shadow-[0_0_0_3px_rgba(16,185,129,.15)]"></span>
                  Email reminders go out before due dates so nothing slips through.
                </li>
                <li className="relative pl-6">
                  <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-emerald-400/90 shadow-[0_0_0_3px_rgba(16,185,129,.15)]"></span>
                  Google Classroom subjects &amp; assignments sync automatically for quick setup.
                </li>
              </ul>
            </div>

            {/* NEW: soft divider between text and cards */}
            <div className="mt-8 border-t border-white/10"></div>

            {/* Bottom: the three reveal cards (now below the section text) */}
            <div className="mt-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <RevealCard
                  short="Deadlines"
                  icon={<EventIcon fontSize="small" />}
                  more="Losing track of due dates hurts performance and increases stress, leading to bigger problems."
                />
                <RevealCard
                  short="Juggling"
                  icon={<AssignmentIcon fontSize="small" />}
                  more="Students juggle multiple timetables and assignment deadlines, causing panic and disorganization."
                />
                <RevealCard
                  short="Gap in Tools"
                  icon={<SchoolIcon fontSize="small" />}
                  more="No tool tightly integrates Google Classroom with timetables + task management—so we built one."
                />
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

// Simple feature card
function FeatureCard({ title, desc }) {
  return (
    // NEW: match reveal-card hover feel (lift + glow + subtle bg change)
    <div className="rounded-2xl border border-white/10 bg-zinc-800/60 p-5 transition
                    hover:bg-zinc-800/80 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/10">
      <h3 className="font-semibold text-zinc-100">{title}</h3>
      <p className="mt-2 text-sm text-zinc-300">{desc}</p>
    </div>
  );
}

//  hover-reveal card 
function RevealCard({ icon, short, more }) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-zinc-800/60 p-4 transition
                    hover:bg-zinc-800/80 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/10">
      {/* top row: icon + short title (always visible) */}
      <div className="flex flex-col items-center text-center gap-2">
        {/* NEW: icon badge box matches theme */}
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl
                        bg-zinc-900/60 border border-white/10 text-zinc-100">
          {icon}
        </div>
        <div className="text-sm font-semibold text-zinc-100 tracking-wide">{short}</div>
      </div>

      {/* reveal body: expands smoothly, never overflows/clips */}
      <div className="mt-2 overflow-hidden transition-[max-height,opacity] duration-300 delay-100 ease-out max-h-0 opacity-0 group-hover:max-h-60 group-hover:opacity-100">
        <div className="mt-3 rounded-lg bg-zinc-900/70 border border-white/10 p-3 text-[13px] leading-relaxed text-zinc-300">
          {more}
        </div>
      </div>
    </div>
  );
}