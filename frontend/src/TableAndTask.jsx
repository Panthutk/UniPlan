import React, { useEffect, useMemo, useRef, useState, memo } from "react";
import { useNavigate, Link } from "react-router-dom";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";


// --- Linking assignments to timetable events ---
function norm(s) {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// returns { linked, day, color, eventTitle }
function linkOneAssignmentToEvents(assignment, events) {
  const aCourse = norm(assignment.courseName);
  const aTitle  = norm(assignment.title);

  // Best effort: match on courseName or assignment title being in event title (or vice versa)
  for (const ev of events || []) {
    const eTitle = norm(ev.title);
    if (!eTitle) continue;

    const match =
      eTitle.includes(aCourse) ||
      aCourse.includes(eTitle) ||
      eTitle.includes(aTitle) ||
      aTitle.includes(eTitle);

    if (match) {
      return {
        linked: true,
        day: ev.day,                              // 0..6
        color: colorForDay(ev.day),               // use your existing day→color helper
        eventTitle: ev.title,
      };
    }
  }
  return { linked: false, day: null, color: "bg-neutral-900", eventTitle: null };
}

function annotateAssignmentsWithEvents(items, events) {
  return (items || []).map((a) => {
    const link = linkOneAssignmentToEvents(a, events);
    return { ...a, _link: link };
  });
}

















/* ----------------- Assignment helpers (no API changes) ----------------- */

// Try to read a due date from various shapes the Classroom JSON might use.
// If missing, we fall back to updateTime/creationTime (so something shows).
function parseDueDate(sub) {
  // Common patterns from Classroom payloads:
  // - sub.dueDate: { year, month, day } and maybe dueTime: { hours, minutes }
  // - sub.assignmentSubmission?.dueDate / dueTime (sometimes nested)
  // - otherwise fallback to updateTime/creationTime
  const pick = (obj, path) =>
    path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj);

  let y = pick(sub, "dueDate.year") ?? pick(sub, "assignmentSubmission.dueDate.year");
  let m = pick(sub, "dueDate.month") ?? pick(sub, "assignmentSubmission.dueDate.month");
  let d = pick(sub, "dueDate.day") ?? pick(sub, "assignmentSubmission.dueDate.day");

  let hh = pick(sub, "dueTime.hours") ?? pick(sub, "assignmentSubmission.dueTime.hours");
  let mm = pick(sub, "dueTime.minutes") ?? pick(sub, "assignmentSubmission.dueTime.minutes");

  if (y && m && d) {
    // JS Date months are 0-based
    const dt = new Date(y, m - 1, d, hh ?? 23, mm ?? 59, 0);
    return isNaN(+dt) ? null : dt;
  }

  // fallback: updated/created
  const t =
    Date.parse(sub.updateTime || "") ||
    Date.parse(sub.creationTime || "") ||
    Date.now();
  const dt = new Date(t);
  return isNaN(+dt) ? null : dt;
}

function daysLeft(fromDate, toDate = new Date()) {
  const ms = parseDueDate(fromDate)?.getTime?.() ?? 0;
  const now = toDate.getTime();
  const diff = Math.ceil((ms - now) / (1000 * 60 * 60 * 24));
  return diff;
}



function buildAssignments(courses, subsByCourse) {
  // Flatten and annotate with course name, “days left”, etc.
  const courseName = (id) =>
    courses.find((c) => (c.id || c.courseId) === id)?.name || "Unknown Course";

  const items = [];
  for (const cid of Object.keys(subsByCourse || {})) {
    for (const s of subsByCourse[cid] || []) {
      const due = parseDueDate(s);
      const left = due ? daysLeft(s) : null;
      items.push({
        id: `${cid}:${s.id}`,
        courseId: cid,
        courseName: courseName(cid),
        title:
          s.title ||
          s.courseWorkType ||
          (s.assignmentSubmission ? "Assignment" : "CourseWork"),
        altLink: s.alternateLink,
        state: s.state || "NEW",
        due,
        daysLeft: left,
        raw: s,
      });
    }
  }

  // sort soonest first; put undated at bottom
  items.sort((a, b) => {
    if (a.due && b.due) return a.due - b.due;
    if (a.due && !b.due) return -1;
    if (!a.due && b.due) return 1;
    return 0;
  });

  return items;
}







/* ----------------- API (from google classroom) ----------------- */
async function authGet(path, token) {
  const r = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!r.ok) throw new Error(`GET ${path} failed (${r.status})`);
  return r.json();
}
function normalizeCourses(json) {
  return Array.isArray(json) ? json : json?.courses || [];
}
function normalizeSubmissions(json) {
  return Array.isArray(json) ? json : json?.studentSubmissions || [];
}
function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d) ? "—" : d.toLocaleString();
}

/* ----------------- time/day ----------------- */
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const TIMES = Array.from({ length: 12 }, (_, i) => 8 + i); // 08..19
const colFromTime = (h) => (h - 8) + 2;   // 8 -> col 2, 19 -> 13
const rowFromDay  = (d) => d + 2;         // 0..6 -> rows 2..8



function colorForDay(day) {
  // 0=Mon ... 6=Sun
  const map = [
    "bg-yellow-400", 
    "bg-pink-400",   
    "bg-green-400",  
    "bg-orange-400", 
    "bg-blue-400",   
    "bg-purple-400", 
    "bg-red-400",    
  ];
  return map[day] ?? "bg-slate-400";
}



/* ----------------- UI: Timetable (clickable & shows events) ------------------- */
const TimetableGrid = memo(function TimetableGrid({ events, onCellClick, onEventClick }) {
  const HEADER_H = 52;
  const ROW_H = 92;
  const LABEL_W = 132;
  const GRID_MIN_W = 0;

  return (
    <div className="rounded-xl bg-neutral-800 p-2 overflow-hidden w-full">
      <div
        className="relative grid gap-[2px] select-none w-full"
        style={{
          minWidth: `${GRID_MIN_W}px`,
          gridTemplateRows: `${HEADER_H}px repeat(7, ${ROW_H}px)`,
          gridTemplateColumns: `${LABEL_W}px repeat(12, minmax(0, 1fr))`,
        }}
      >
        {/* Corner */}
        <div className="bg-neutral-900/60 flex items-center justify-center text-xs">
          Day/Time
        </div>

        {/* Time headers */}
        {TIMES.map((h) => (
          <div
            key={h}
            className="bg-neutral-900/60 flex items-center justify-center text-xs"
          >
            {h}:00
          </div>
        ))}

        {/* Day labels */}
        {DAYS.map((d, i) => (
          <div
            key={d}
            className="bg-neutral-900/60 flex items-center justify-center text-xs"
            style={{ gridRow: i + 2, gridColumn: 1 }}
          >
            {d}
          </div>
        ))}

        {/* Background cells*/}
        {DAYS.map((_, di) =>
          TIMES.map((h, ti) => (
            <button
              key={`bg-${di}-${ti}`}
              type="button"
              onClick={() => onCellClick(di, h)}
              className="bg-neutral-900/20 hover:bg-neutral-900/30 transition-colors"
              style={{ gridRow: di + 2, gridColumn: ti + 2, cursor: "pointer" }}
              aria-label={`Add on ${DAYS[di]} at ${h}:00`}
            />
          ))
        )}

        {/* Events layer*/}
        {events.map((e) => (
          <div
            key={e.id}
            onClick={(ev) => { ev.stopPropagation(); onEventClick?.(e); }}
            className={`rounded-md text-black p-2 text-xs font-semibold ${e.color || "bg-emerald-400"} cursor-pointer hover:opacity-90`}
            style={{
              gridRow: rowFromDay(e.day),
              gridColumn: `${colFromTime(e.start)} / ${colFromTime(e.end)}`,
              zIndex: 10,
            }}
            title={`${e.title} — ${e.start}:00–${e.end}:00`}
          >
            {e.title}
            <div className="text-[10px] opacity-80">
              {e.start}:00–{e.end}:00
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

/* ----------------- UI: Tasks (from API) -------------------- */
function CourseTasksCard({ course, submissions, showRaw }) {
  const id = course.id || course.courseId;
  const subs = (submissions || [])
    .slice()
    .sort((a, b) => {
      const ta = Date.parse(a.updateTime || a.creationTime || 0);
      const tb = Date.parse(b.updateTime || b.creationTime || 0);
      return (tb || 0) - (ta || 0);
    });

  return (
    <div className="rounded-xl border border-white/10 p-4 bg-white/5">
      <div className="flex items-baseline justify-between">
        <div className="font-medium">
          {course.name}{" "}
          {course.section ? <span className="opacity-70">({course.section})</span> : null}
        </div>
        <div className="text-xs opacity-70">ID: {id}</div>
      </div>

      <div className="mt-3 text-sm font-semibold">Active Assignments ({subs.length})</div>

      {subs.length === 0 ? (
        <div className="text-sm opacity-70 mt-1">No active assignments.</div>
      ) : (
        <ul className="mt-2 space-y-2">
          {subs.map((s) => (
            <li key={s.id} className="rounded-lg border border-white/10 p-3 bg-white/5">
              <div className="font-medium">
                #{s.courseWorkId} · {s.courseWorkType || "CourseWork"}
              </div>
              <div className="text-xs opacity-70">
                State: {s.state} · Late: {String(s.late)} · Created: {fmtDate(s.creationTime)} · Updated: {fmtDate(s.updateTime)}
              </div>
              {s.alternateLink && (
                <a className="text-xs underline" href={s.alternateLink} target="_blank" rel="noreferrer">
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

      {showRaw && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs opacity-70">Course raw JSON</summary>
          <pre className="mt-2 text-xs bg-black/10 p-3 rounded overflow-auto">
            {JSON.stringify(course, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

const TasksSection = memo(function TasksSection({ courses, subsByCourse, showRaw }) {
  if (!courses?.length) return <div className="text-sm opacity-70">No active classes found.</div>;
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {courses.map((c) => (
        <CourseTasksCard
          key={c.id || c.courseId}
          course={c}
          submissions={subsByCourse[c.id || c.courseId]}
          showRaw={showRaw}
        />
      ))}
    </div>
  );
});




/* -----------------Assignments Board----------------- */
function AssignmentsBoard({ items }) {
  const groups = useMemo(() => {
    const m = new Map();
    for (const a of items || []) {
      const key = a._link?.linked ? String(a._link.day ?? "Unassigned") : "Unassigned";
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(a);
    }
    // sort inside each group by due date (soonest first)
    for (const [k, arr] of m) {
      arr.sort((x, y) => {
        if (x.due && y.due) return x.due - y.due;
        if (x.due && !y.due) return -1;
        if (!x.due && y.due) return 1;
        return 0;
      });
    }
    return m;
  }, [items]);

  const orderKeys = ["0","1","2","3","4","5","6","Unassigned"].filter(k => groups.has(k));

  if (orderKeys.length === 0) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Tasks</h3>
        </div>
        <div className="text-sm opacity-70">No tasks to show.</div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Tasks</h3>
      </div>

      {orderKeys.map((key) => {
        const list = groups.get(key) || [];
        const isUnassigned = key === "Unassigned";
        const dayIdx = isUnassigned ? null : Number(key);
        const dayName = isUnassigned ? "Unassigned" : DAYS[dayIdx];
        const headerChip = isUnassigned ? "bg-neutral-800" : colorForDay(dayIdx);

        return (
          <div key={key} className="space-y-3">
            {/* Section header */}
            <div className="flex items-center gap-2">
              <span className={`inline-block h-3 w-3 rounded ${headerChip}`} />
              <h4 className="font-semibold">{dayName}</h4>
              <span className="text-xs opacity-60">({list.length})</span>
            </div>

            {/* Cards */}
            <div className="space-y-4">
              {list.map((a) => {
                const n = a.daysLeft;
                const leftText =
                  n == null ? "—" : `${Math.max(n, 0)} Day${Math.abs(n) === 1 ? "" : "s"} Left`;

                const linked  = a._link?.linked;
                const dayBg   = linked ? (a._link?.color || "bg-neutral-900") : "bg-neutral-900";
                const ringCls = linked ? "ring-emerald-300" : "ring-neutral-700";

                return (
                  <div
                    key={a.id}
                    className={`grid grid-cols-[10rem,1fr] rounded-xl border border-white/10 ring-1 ${ringCls} bg-white/5 overflow-hidden`}
                  >
                    {/* Left label (day color only when linked) */}
                    <div className={`${dayBg} text-neutral-900 font-bold flex items-center justify-center p-3`}>
                      <div className="text-center text-xl">{leftText}</div>
                    </div>

                    {/* Right content */}
                    <div className="p-4 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm opacity-80 truncate">
                          <span className="tracking-wider">{a.courseName}</span>
                          {linked && a._link?.eventTitle ? (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-neutral-800 border border-white/10">
                              {a._link.eventTitle}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* HW line only when linked */}
                      {linked ? (
                        <div className="mt-1 text-sm">
                          <span className="opacity-80 mr-2">HW:</span>
                          <span className="font-semibold">{a.title}</span>
                        </div>
                      ) : (
                        <div className="mt-1 text-sm opacity-50 italic">Not assigned on timetable</div>
                      )}

                      <div className="mt-3 flex items-center gap-3">
                        {a.altLink && (
                          <a
                            href={a.altLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-green-600 hover:bg-green-700 font-semibold"
                            title="Open in Classroom"
                          >
                            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-black/70" />
                            Classroom
                          </a>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                          <span className="text-xs opacity-75">Status:</span>
                          <span className="text-xs px-3 py-1.5 rounded-full bg-neutral-800 border border-white/10">
                            OPEN
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}









/* ----------------- Modal form (Subject combo box from API) -------------------- */
function EventModal({ open, initial, onClose, onSave, onDelete, subjectOptions }) {
  const [title, setTitle] = useState(initial.title || "");
  const [day, setDay] = useState(initial.day ?? 0);
  const [start, setStart] = useState(initial.start ?? 8);
  const [end, setEnd] = useState(initial.end ?? 9);
  const [desc, setDesc] = useState(initial.desc || "");

  useEffect(() => {
    if (!open) return;
    setTitle(initial.title || "");
    setDay(initial.day ?? 0);
    setStart(initial.start ?? 8);
    setEnd(initial.end ?? Math.min((initial.start ?? 8) + 1, 20));
    setDesc(initial.desc || "");
  }, [open, initial]);

  if (!open) return null;

  const isEditing = Boolean(initial?.id);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                      w-[min(560px,92vw)] rounded-2xl bg-neutral-900 text-white p-5 shadow-xl">
        <div className="text-lg font-semibold mb-1">Subject</div>
        <div className="text-xs opacity-70 mb-2">
          You can add subject from Google Classroom or manually add it
        </div>

        {/* Combo box */}
        <input
          list="subject-options"
          className="w-full mb-4 rounded-md bg-neutral-800 px-3 py-2 outline-none focus:ring-2 ring-emerald-500/50"
          placeholder="Start typing to choose…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <datalist id="subject-options">
          {subjectOptions.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-sm mb-1">Start Class</div>
            <select
              className="w-full rounded-md bg-neutral-800 px-3 py-2 outline-none focus:ring-2 ring-emerald-500/50"
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
            >
              {TIMES.map((h) => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-sm mb-1">End Class</div>
            <select
              className="w-full rounded-md bg-neutral-800 px-3 py-2 outline-none focus:ring-2 ring-emerald-500/50"
              value={end}
              onChange={(e) => setEnd(Number(e.target.value))}
            >
              {TIMES.map((h) => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <div className="text-sm mb-1">Day</div>
          <select
            className="w-full rounded-md bg-neutral-800 px-3 py-2 outline-none focus:ring-2 ring-emerald-500/50"
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
          >
            {DAYS.map((d, i) => (
              <option key={d} value={i}>{d}</option>
            ))}
          </select>
        </div>

        <div className="mt-3">
          <div className="text-sm mb-1">Description</div>
          <textarea
            rows={4}
            className="w-full rounded-md bg-neutral-800 px-3 py-2 outline-none focus:ring-2 ring-emerald-500/50"
            placeholder="Optional"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          {/* DELETE only when editing */}
          {isEditing ? (
            <button
              onClick={() => onDelete?.(initial.id)}
              className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 font-semibold"
            >
              DELETE
            </button>
          ) : <span />}

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-full bg-neutral-700 hover:bg-neutral-600 font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const s = Math.min(start, end);
                const e = Math.max(start, end);
                onSave({
                  ...(isEditing ? { id: initial.id } : {}),
                  title: title || "Untitled",
                  day,
                  start: s,
                  end: Math.max(e, s + 1),
                  desc,
                });
              }}
              className="px-6 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 font-semibold"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Page: layout  */
export default function ClassroomTimetableDashboard() {
  const nav = useNavigate();
  const token = localStorage.getItem("jwt");
  const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "null"), []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [courses, setCourses] = useState([]);
  const [subsByCourse, setSubsByCourse] = useState({});
  const [showRaw, setShowRaw] = useState(false);

  // local timetable events created via the modal
  const [events, setEvents] = useState([]);

  // Refs + active-menu logic (center-closest)
  const timetableRef = useRef(null);
  const tasksRef = useRef(null);
  const [activeMenu, setActiveMenu] = useState("timetable");
  const activeRef = useRef(activeMenu);
  useEffect(() => { activeRef.current = activeMenu; }, [activeMenu]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState({ day: 0, start: 8, end: 9, title: "", desc: "" });

  // Initialize from grid (create)
  const handleCellClick = (dayIdx, hour) => {
    setModalInitial({ day: dayIdx, start: hour, end: Math.min(hour + 1, 20), title: "", desc: "" });
    setModalOpen(true);
  };

  // Initialize from event (edit)
  const handleEventClick = (evt) => {
    setModalInitial({ ...evt }); // contains id, title, day, start, end, desc, color
    setModalOpen(true);
  };

const handleSaveEvent = (payload) => {
  if (payload.id) {
    // update existing
    setEvents(prev =>
      prev.map(e =>
        e.id === payload.id ? { ...e, ...payload, color: colorForDay(payload.day) } : e
      )
    );
  } else {
    // create new
    setEvents(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        color: colorForDay(payload.day),
        ...payload,
      },
    ]);
  }
  setModalOpen(false);
};


  const handleDeleteEvent = (id) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setModalOpen(false);
  };

  const handleClearEvents = () => {
    setEvents([]);
    setModalOpen(false);
  };


  useEffect(() => {
    if (!token) { nav("/login"); return; }
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const coursesJson = await authGet("/api/classroom/courses", token);
        const active = normalizeCourses(coursesJson).filter(
          (c) => (c.courseState || c.state || "ACTIVE") === "ACTIVE"
        );
        setCourses(active);

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

  // subject options for datalist
  const subjectOptions = useMemo(() => {
    const set = new Set();
    for (const c of courses) if (c?.name) set.add(c.name.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [courses]);




  const liveAssignments = useMemo(
    () => buildAssignments(courses, subsByCourse),
    [courses, subsByCourse]
  );





// Link assignments to timetable events (so board knows which ones are placed)
  const linkedAssignments = useMemo(
    () => annotateAssignmentsWithEvents(liveAssignments, events),
    [liveAssignments, events]
  );


  // Active menu (closest section center)
  useEffect(() => {
    let raf = 0;
    const computeActive = () => {
      const t = timetableRef.current;
      const k = tasksRef.current;
      if (!t || !k) return;

      const vh = window.innerHeight || document.documentElement.clientHeight;
      const centerY = vh / 2;

      const rectT = t.getBoundingClientRect();
      const rectK = k.getBoundingClientRect();

      const isVis = (r) => r.bottom > 0 && r.top < vh;
      const dist = (r) => Math.abs((r.top + r.bottom) / 2 - centerY);

      const tVis = isVis(rectT);
      const kVis = isVis(rectK);

      let next = activeRef.current;

      if (tVis && !kVis) next = "timetable";
      else if (!tVis && kVis) next = "tasks";
      else if (tVis && kVis) next = dist(rectK) <= dist(rectT) ? "tasks" : "timetable";

      if (next !== activeRef.current) setActiveMenu(next);
    };

    const onScrollOrResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(computeActive);
    };

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    onScrollOrResize();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, []);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-neutral-900 text-white" style={{ fontFamily: "Manrope, sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 py-3 bg-neutral-900/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/60">
        <div className="w-full pl-5 sm:pl-6 lg:pl-8 pr-5 sm:pr-6 lg:pr-8 flex items-center">
          <div className="font-bold tracking-wide text-lg">LOGO</div>

          <div className="ml-auto flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm opacity-80">
              <input
                type="checkbox"
                className="accent-current"
                checked={showRaw}
                onChange={(e) => setShowRaw(e.target.checked)}
              />
              Show raw JSON
            </label>
            <Link to="/about" className="opacity-90 text-sm hover:underline">Contact</Link>
            <button
              className="border rounded-lg px-3 py-2"
              onClick={() => { localStorage.clear(); nav("/", { replace: true }); }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>




      {/* Layout: [CENTER MENU CARD][RIGHT MAIN] */}
      <div className="mx-auto max-w-[1800px] 2xl:max-w-[2000px] px-4 sm:px-6 lg:px-8">
        <div className="pb-10 grid grid-cols-1 md:grid-cols-[minmax(320px,360px),minmax(0,1fr)] xl:grid-cols-[minmax(300px,340px),minmax(0,1fr)] 2xl:grid-cols-[minmax(320px,360px),minmax(0,1fr)] gap-y-6 md:gap-x-10 items-start min-w-0">

          {/* CENTER — sticky/tall menu card */}
          <section
            className="
              bg-neutral-800 rounded-2xl p-4
              flex flex-col
              md:sticky md:top-[72px] md:z-40 self-start
              min-h-[60vh] md:min-h-0
              md:max-h-[calc(100vh-72px-16px)]
              md:overflow-auto
            "
          >
            {/* user chip */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-4 w-4 rounded-full bg-emerald-500" />
              <div className="font-semibold text-lg sm:text-xl md:text-2xl leading-tight truncate">
                {user?.email || "student@gmail.com"}
              </div>
            </div>


            {/* Active buttons */}
            <div className="space-y-3">
              <button
                onClick={() => timetableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                aria-current={activeMenu === "timetable" ? "page" : undefined}
                className={[
                  "w-full py-4 rounded-full font-semibold transition-colors",
                  activeMenu === "timetable"
                    ? "bg-emerald-700 hover:bg-emerald-800 ring-2 ring-emerald-400/40"
                    : "bg-neutral-700 hover:bg-neutral-600",
                ].join(" ")}
              >
                TimeTable
              </button>

              <button
                onClick={() => tasksRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                aria-current={activeMenu === "tasks" ? "page" : undefined}
                className={[
                  "w-full py-4 rounded-full font-semibold transition-colors",
                  activeMenu === "tasks"
                    ? "bg-emerald-700 hover:bg-emerald-800 ring-2 ring-emerald-400/40"
                    : "bg-neutral-700 hover:bg-neutral-600",
                ].join(" ")}
              >
                Tasks
              </button>
            </div>
          </section>

          {/* RIGHT — timetable + tasks */}
          <main className="space-y-6 min-w-0">
            {/* actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={handleClearEvents}
                className="px-5 py-2 rounded-full bg-rose-500 hover:bg-rose-600 font-semibold"
              >
                Clear
              </button>
              <button className="px-5 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 font-semibold">
                Import
              </button>
              <button className="px-5 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 font-semibold">
                Export
              </button>
            </div>

            {/* Timetable (click cells to add; click events to edit) */}
            <div ref={timetableRef} className="scroll-mt-[80px] min-w-0">
              <TimetableGrid
                events={events}
                onCellClick={handleCellClick}
                onEventClick={handleEventClick}
              />
            </div>


          
            <div ref={tasksRef} className="scroll-mt-[80px]">
            <AssignmentsBoard
              items={linkedAssignments}
            />
            </div>






            {/* Tasks */}
            <section  className="scroll-mt-[80px]">
              <h2 className="text-lg font-semibold mb-3">Api from google classroom </h2>


            {/* Status moved here */}
            {loading && (
              <div className="text-sm opacity-70 mb-3">
                Loading active classes & active assignments…
              </div>
            )}
            {err && (
              <div className="text-sm text-rose-400 mb-3">
                Error: {err}
              </div>
            )}


              <TasksSection
                courses={courses}
                subsByCourse={subsByCourse}
                showRaw={showRaw}
              />
            </section>
          </main>
        </div>
      </div>

      {/* Modal */}
      <EventModal
        open={modalOpen}
        initial={modalInitial}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        subjectOptions={subjectOptions}
      />
    </div>
  );
}
