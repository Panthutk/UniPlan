import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SaveIcon from '@mui/icons-material/Save';
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';

// Helper Calling
import { get, post, patch, del, API, BASE_URL, authHeader } from "./utils/api";
import { DAYS, parseHHMM, toHHMM, toLabelSS } from "./utils/time";
import { colorForDay } from "./utils/color.js";

// Components Calling
import { HeaderSection } from "../components/layout/header.jsx";
import { DrawerPanel } from "../components/layout/drawerPanel.jsx";

import { exportTimetableCSV, importTimetableCSV, listSubjects, listTimetable } from "./utils/api";


async function whoami() {
  // returns { id, username, email, ... } when logged in, or {} if anonymous
  return get(`/api/whoami/`);
}

async function createSubject(name) {
  const subjectsNow = await listSubjects();
  const code = uniqueCodeFromName(name, subjectsNow);
  const color_hex = CreateNewColorHex();
  return post(`/api/subjects/`, { name, code, color_hex }); // server sets user
}

async function createTimetableEntry(row) {
  return post(`/api/timetable/`, row);
}
async function updateTimetableEntry(id, partial) {
  return patch(`/api/timetable/${id}/`, partial);
}
async function deleteTimetableEntry(id) {
  return del(`/api/timetable/${id}/`);
}

function CreateNewColorHex() {
  const randomColor = Math.floor(Math.random() * 16777215).toString(16);
  return `#${randomColor.padStart(6, "0")}`;
}


// UI uses 0=Mon..6=Sun, backend uses 0=Sun..6=Sat
const uiToDbDay = (ui) => (ui + 1) % 7;  // Mon(0)->1 ... Sun(6)->0
const dbToUiDay = (db) => (db + 6) % 7;  // Sun(0)->6 ... Mon(1)->0


const slugify = (s) =>
  s.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

function uniqueCodeFromName(name, existingSubjects) {
  const base = slugify(name) || "untitled";
  let code = base;
  let i = 1;
  const taken = new Set(
    (existingSubjects || []).map(s => (s.code || "").toLowerCase())
  );
  while (taken.has(code.toLowerCase())) {
    i += 1;
    code = `${base}-${i}`;
  }
  return code;
}


// helper for timetable in  minute

const STEP_MIN = 15;
const DAY_START_H = 8;
const DAY_END_H = 20;




// split hour and min
const getHour = (m) => Math.floor(m / 60);
const getMinute = (m) => m % 60;

// options for hour/minute selects
const HOURS = Array.from({ length: DAY_END_H - DAY_START_H + 1 }, (_, i) => DAY_START_H + i);
const MINUTES = Array.from({ length: 60 / STEP_MIN }, (_, i) => i * STEP_MIN);


// help for adjust the column card
const COL_W = 120;




async function getSubjectKeyByCourse(courseName, setSubjects) {
  // get all subjects from backend
  const subjects = await listSubjects();
  // look for an existing subject by name
  const match = subjects.find(sub => sub.name === courseName);

  if (match) {
    // found tell user the Key
    return match.id;
  } else {
    // not found create new Subject obj
    const newSubject = await createSubject(courseName);
    setSubjects(prev => [...prev, newSubject]);
    return newSubject.id;
  }
}


// Send new assignment to tasks DB
async function syncAssignmentsToTasks(assignments, setSubjects) {
  try {
    const existingTasks = await get("/api/tasks/");
    const classroomIds = new Set(assignments.map(a => a.id));
    const existingClassroomTasks = existingTasks.filter(t => t.source === "classroom");
    const existingIds = new Set(existingClassroomTasks.map(t => t.external_id));

    // Find new assignments from classroom API
    const newAssignments = assignments.filter(a => !existingIds.has(a.id));

    // check assignments that not appear in classroom API anymore
    const removedTasks = existingClassroomTasks.filter(t => !classroomIds.has(t.external_id));

    // Add new assignments
    for (const a of newAssignments) {
      const subjectKey = await getSubjectKeyByCourse(a.courseName, setSubjects);

      const body = {
        title: a.title,
        subject: subjectKey,
        due_at: a.due ? new Date(a.due).toISOString() : null,
        source: "classroom",
        external_id: a.id,
        assignment_alt_link: a.altLink
      };
      await post("/api/tasks/", body);
    }

    // Delete finished assignments
    for (const t of removedTasks) {
      await del(`/api/tasks/${t.id}/`);
    }

  } catch (e) {
    console.error("Sync failed:", e);
  }
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

async function SetupTasks(courses, subsByCourse, setSubjects) {
  // Build live assignments from classroom API
  const liveAssignments = buildAssignments(courses, subsByCourse);

  // push to Task DB
  if (liveAssignments?.length) {
    await syncAssignmentsToTasks(liveAssignments, setSubjects);
  }

  // Get task data from DB
  const tasksObject = await get("/api/tasks/");
  return tasksObject;
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




/* ----------------- Modal form (Subject combo box from API) -------------------- */
function EventModal({ open, initial, onClose, onSave, onDelete, subjectOptions, existingEvents = [] }) {
  const [title, setTitle] = useState(initial.title || "");
  const [day, setDay] = useState(initial.day ?? 0);
  const [start, setStart] = useState(initial.startMin ?? DAY_START_H * 60); // store minute since midnight 480 min (8 am)
  const [end, setEnd] = useState(initial.endMin ?? (DAY_START_H * 60 + 60));
  const [desc, setDesc] = useState(initial.desc || "");
  const [error, setError] = useState("");
  const isNew = !initial?.id

  useEffect(() => {
    if (!open) return;
    setTitle(initial.title || "");
    setDay(initial.day ?? 0);
    setStart(initial.startMin ?? DAY_START_H * 60);
    setEnd(isNew ? Math.min((initial.startMin ?? DAY_START_H * 60) + 60, DAY_END_H * 60) : (initial.endMin ?? Math.min((initial.startMin ?? DAY_START_H * 60) + 60, DAY_END_H * 60)));
    setDesc(initial.desc || "");
    setError("");
  }, [open, initial]);

  // Derived validations
  const timeError = end <= start; // strictly after required (raw values)
  const s = Math.min(start, end);
  const e = Math.max(start, end);
  const normalizedTitle = (title || "Untitled").trim().toLowerCase(); // Converts everything to lowercase so comparisons don’t care about capitalization.



  // Exact duplicate (same day+time+title; ignore current when editing)

  const duplicateError = existingEvents.some(ev =>
    ev.day === day &&
    ev.start === s &&
    ev.end === e &&
    ev.title?.trim()?.toLowerCase() === normalizedTitle &&
    (!initial?.id || ev.id !== initial.id)
  );

  // Time overlap with another event on same day (if you want to prevent overlaps)
  const overlapError = existingEvents.some(ev =>
    ev.day === day &&
    (!initial?.id || ev.id !== initial.id) &&
    // overlap if start < other.end AND end > other.start
    s < ev.end && e > ev.start
  );

  const firstError = (timeError && "End time must be after start time.") ||
    (duplicateError && "This subject already exists with the same day and time.") ||
    (overlapError && "This time overlaps another subject on the same day.");

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
            <div className="flex items-center gap-2">
              {/* Hour */}
              <select
                aria-label="Start hour"
                className="w-24 h-10 rounded-md bg-neutral-800 border border-neutral-600 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/70"
                value={getHour(start)}
                onChange={(e) => {
                  const h = parseInt(e.target.value, 10);
                  setStart(h * 60 + getMinute(start));
                }}
              >
                {HOURS.map(h => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}</option>
                ))}
              </select>

              <div className="text-neutral-400">:</div>

              {/* Minute */}
              <select
                aria-label="Start minute"
                className="w-24 h-10 rounded-md bg-neutral-800 border border-neutral-600 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/70"
                value={getMinute(start)}
                onChange={(e) => {
                  const m = parseInt(e.target.value, 10);
                  setStart(getHour(start) * 60 + m);
                }}
              >
                {MINUTES.filter(m => getHour(start) < DAY_END_H || m == 0).map(m => (
                  <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div className="text-sm mb-1">End Class</div>
            <div className="flex items-center gap-2">
              {/* Hour */}
              <select
                aria-label="End hour"
                className="w-24 h-10 rounded-md bg-neutral-800 border border-neutral-600 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/70"
                value={getHour(end)}
                onChange={(e) => {
                  const h = parseInt(e.target.value, 10);
                  const newEnd = h * 60 + getMinute(end);
                  setEnd(Math.min(newEnd, DAY_END_H * 60));
                }}
              >
                {HOURS.map(h => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}</option>
                ))}
              </select>

              <div className="text-neutral-400">:</div>

              {/* Minute */}
              <select
                aria-label="End minute"
                className="w-24 h-10 rounded-md bg-neutral-800 border border-neutral-600 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/70"
                value={getMinute(end)}
                onChange={(e) => {
                  const m = parseInt(e.target.value, 10);
                  setEnd(Math.min(getHour(end) * 60 + m, DAY_END_H * 60));
                }}
              >
                {MINUTES.filter(m => getHour(end) < DAY_END_H || m === 0).map(m => (
                  <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                ))}
              </select>
            </div>
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

        {/*Show the alert text*/}
        {firstError && (<div className="mt-3 text-sm text-rose-400" role="alert" aria-live="assertive">Alert: {firstError} </div>)}

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
                // run validation again
                if (firstError) {

                  setError(firstError);

                }

                // call back parent function ClassroomTimetableDashboard
                onSave({
                  ...(isEditing ? { id: initial.id } : {}),
                  title: title || "Untitled",
                  day,
                  startMin: s,
                  endMin: Math.max(e, s + STEP_MIN), //send minute outward
                  desc,
                });
              }}
              className={["px-6 py-2 rounded-full font-semibold", firstError ? "bg-neutral-700 cursor-not-allowed" : "bg-emerald-700 hover:bg-emerald-800"].join(" ")}
              disabled={Boolean(firstError)}
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
  // DB-backed subjects and user id (temp)
  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [reminders, setReminders] = useState([]);

  // local timetable events created via the modal
  const [events, setEvents] = useState([]);


  // hamburger drawer
  const [menuOpen, setMenuOpen] = useState(false); // false = hidden, true = visible

  // task
  const [taskObjects, setTaskObjects] = useState([]);

  // archived task
  const [archivedTasks, setArchivedTasks] = useState([]);
  const [showArchivedPopup, setShowArchivedPopup] = useState(false);

  // loading state for tasks
  const [tasksLoading, setTasksLoading] = useState(false);

  // searchArchived state
  const [searchQuery, setSearchQuery] = useState("");




  useEffect(() => {
    (async () => {
      try {
        const data = await whoami();        // { id, ... } when logged in
        if (data && data.id) setMe(data);
      } catch (e) {
        console.error("whoami failed:", e);
      } finally {
        setMeLoading(false);
      }
    })();
  }, []);


  useEffect(() => {
    if (!me || !me.id || meLoading) return;   // wait until we know who the user is
    (async () => {
      try {
        const [subj, tte] = await Promise.all([
          listSubjects(me.id),
          listTimetable(me.id), //UI after refresh it, api call backend will return data from db
        ]);
        setSubjects(subj);

        const byId = Object.fromEntries(subj.map(s => [s.id, s]));
        const evs = tte.map(t => ({
          id: t.id,
          subjectId: t.subject,
          title: byId[t.subject]?.name || "Untitled",
          day: dbToUiDay(t.day_of_week),
          start: parseHHMM(t.start_time),
          end: parseHHMM(t.end_time),
          desc: t.room || "",
          color: colorForDay(dbToUiDay(t.day_of_week)),
        }));
        setEvents(evs);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [me, me?.id, meLoading]);


  // Refs + active-menu logic (center-closest)
  const timetableRef = useRef(null);
  const tasksRef = useRef(null);
  const [activeMenu, setActiveMenu] = useState("timetable");
  const activeRef = useRef(activeMenu);
  const fileInputRef = useRef(null);
  const [importBusy, setImportBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  useEffect(() => { activeRef.current = activeMenu; }, [activeMenu]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState({ day: 0, start: 8, end: 9, title: "", desc: "" });

  const handleExportClick = async () => {
  try {
    setExportBusy(true);
    await exportTimetableCSV();
  } catch (e) {
    console.error(e);
    alert(e.message || "Export failed");
  } finally {
    setExportBusy(false);
  }
};

const handleImportClick = () => fileInputRef.current?.click();

const handleImportChange = async (ev) => {
  const file = ev.target.files?.[0];
  // allow selecting the same file again next time
  ev.target.value = "";
  if (!file) return;

  try {
    setImportBusy(true);
    const res = await importTimetableCSV(file);
    alert(`Import success: replaced ${res?.replaced ?? 0} entries`);

    // refresh timetable from DB and rebuild events
    const [subj, tte] = await Promise.all([listSubjects(), listTimetable()]);
    setSubjects(subj);
    const byId = Object.fromEntries(subj.map(s => [s.id, s]));
    const evs = tte.map(t => ({
      id: t.id,
      subjectId: t.subject,
      title: byId[t.subject]?.name || "Untitled",
      day: dbToUiDay(t.day_of_week),
      start: parseHHMM(t.start_time),
      end: parseHHMM(t.end_time),
      desc: t.room || "",
      color: colorForDay(dbToUiDay(t.day_of_week)),
    }));
    setEvents(evs);
  } catch (e) {
    console.error(e);
    alert(e.message || "Import failed");
  } finally {
    setImportBusy(false);
  }
};


  // Initialize from grid (create)
  const handleCellClick = (dayIdx, hour) => {
    setModalInitial({ day: dayIdx, startMin: hour * 60, endMin: Math.min(hour * 60 + STEP_MIN, DAY_END_H * 60), title: "", desc: "" });
    setModalOpen(true);
  };

  // Initialize from event (edit)
  const handleEventClick = (evt) => {
    setModalInitial({ ...evt, startMin: evt.start, endMin: evt.end }); // contains id, title, day, start, end, desc, color
    setModalOpen(true);
  };
  // take modal data then sends a POST or PUT request to /api/timetable/
  const handleSaveEvent = async (payload) => {
    try {
      const desiredName = (payload.title || "Untitled").trim();

      // 1) find-or-create Subject by name (case-insensitive)
      let subject = subjects.find(s => s.name.toLowerCase() === desiredName.toLowerCase());
      if (!subject) {
        subject = await createSubject(desiredName);
        setSubjects(prev => [...prev, subject]);
      }

      // 2) normalize time
      const sMin = Math.min(payload.startMin ?? payload.start, payload.endMin ?? payload.end);
      const eMin = Math.max(payload.startMin ?? payload.start, payload.endMin ?? payload.end);

      // for api
      const start_time = toLabelSS(sMin);  // "HH:MM:SS"
      const end_time = toLabelSS(eMin);


      if (payload.id && typeof payload.id === "number") {
        // UPDATE existing timetable entry
        const updated = await updateTimetableEntry(payload.id, {
          subject: subject.id,
          day_of_week: uiToDbDay(payload.day),   // <-- map UI -> DB
          start_time,
          end_time,
          room: payload.desc || "",
        });

        setEvents(prev => prev.map(ev =>
          ev.id === payload.id
            ? {
              ...ev,
              subjectId: subject.id,
              title: subject.name,
              day: dbToUiDay(updated.day_of_week),                 // map DB -> UI
              start: sMin,
              end: eMin,
              desc: updated.room,
              color: colorForDay(dbToUiDay(updated.day_of_week)),  // color for UI day
            }
            : ev
        ));


        // toast notification (use local subject)
        pushToast({
          type: "success",
          tittle: "Subject updated",
          desc: `${subject.name} · ${DAYS[dbToUiDay(updated.day_of_week)]} ${toHHMM(sMin)}–${toHHMM(eMin)}`,
          icon: <SaveIcon sx={{ fontSize: 20 }} />,
        });


      } else {
        // CREATE new timetable entry
        const created = await createTimetableEntry({
          subject: subject.id,
          day_of_week: uiToDbDay(payload.day),
          start_time,
          end_time,
          room: payload.desc || "",
        });

        setEvents(prev => [
          ...prev,
          {
            id: created.id,
            subjectId: subject.id,
            title: subject.name,
            day: dbToUiDay(created.day_of_week),              // map DB -> UI
            start: sMin,
            end: eMin,
            desc: created.room,
            color: colorForDay(dbToUiDay(created.day_of_week)) // color for UI day
          },
        ]);

        pushToast({
          type: "success",
          tittle: "Subject added",
          desc: `${subject.name} · ${DAYS[dbToUiDay(created.day_of_week)]} ${toHHMM(sMin)}–${toHHMM(eMin)}`,
          icon: <SaveIcon sx={{ fontSize: 20 }} />,
        });

      }

      setModalOpen(false);
    } catch (err) {
      console.error(err);
      pushToast({
        type: "error",
        title: "Save failed",
        desc: String(err?.message || err),
      });
    }
  };

  const handleDeleteEvent = async (id) => {
    try {
      const removed = events.find(e => e.id === id);

      if (typeof id === "number") {
        await deleteTimetableEntry(id);
      }
      setEvents(prev => prev.filter(e => e.id !== id));
      setModalOpen(false);

      pushToast({
        type: "success",
        title: "Subject deleted",
        desc: removed ? removed.title : "",
        icon: <DeleteForeverIcon sx={{ fontSize: 20 }} />
      });

    } catch (err) {
      console.error(err);
      pushToast({
        type: "error",
        title: "Delete failed",
        desc: String(err?.message || err),
      });
    }
  };

  const handleClearEvents = async () => {
    try {
      const ids = events.filter(e => typeof e.id === "number").map(e => e.id);
      await Promise.allSettled(ids.map(id => deleteTimetableEntry(id)));
      setEvents([]);
      setModalOpen(false);

      pushToast({
        type: "success",
        title: "All subjects cleared",
        desc: `${ids.length} subject${ids.length !== 1 ? "s" : ""} removed.`,
        icon: <CleaningServicesIcon sx={{ fontSize: 20 }} />,
      });


    } catch (err) {
      console.error(err);
      pushToast({
        type: "error",
        title: "Clear failed",
        desc: String(err?.message || err),
      });

    }
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

  useEffect(() => {
    (async () => {
      if (!courses.length || !Object.keys(subsByCourse).length) return;
      try {
        const tasks = await SetupTasks(courses, subsByCourse, setSubjects);
        setTaskObjects(tasks);
      } catch (err) {
        console.error("Failed to fetch or sync tasks:", err);
      }
    })();
  }, [courses, subsByCourse]);

  async function handleUpdateTask(id, newData) {
    await patch(`/api/tasks/${id}/`, newData);
    setTaskObjects(prev =>
      prev.map(t => (t.id === id ? { ...t, ...newData } : t))
    );
  }

  async function archiveTask(id) {
    const r = await fetch(`${API}/api/tasks/${id}/archive/`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeader() },
    });
    if (!r.ok) throw new Error(`POST /api/tasks/${id}/archive/ failed (${r.status})`);
    const result = await r.json();
    await fetchTasks();
    return result;
  }

  async function unarchiveTask(id) {
    const r = await fetch(`${API}/api/tasks/${id}/unarchive/`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeader() },
    });
    if (!r.ok) throw new Error(`POST /api/tasks/${id}/unarchive/ failed (${r.status})`);
    return r.json();
  }


  async function handleUnarchive(id) {
    try {
      await unarchiveTask(id);
      alert("Task unarchived successfully!");
      await fetchTasks(); // refresh main list
      const refreshedArchived = await listArchivedTasks();
      setArchivedTasks(refreshedArchived.filter(t => t.is_archived === true));
    } catch (e) {
      console.error(e);
      alert("Failed to unarchive task: " + e.message);
    }
  }



  async function fetchTasks() {
    try {
      setTasksLoading(true);
      const data = await get("/api/tasks/");
      setTaskObjects(data);
    } catch (e) {
      console.error("Failed to refresh tasks:", e);
    } finally {
      setTasksLoading(false);
    }
  }

  async function listArchivedTasks() {
    return get(`/api/tasks/?archived=true`);
  }

  async function handleShowArchived() {
    try {
      const data = await listArchivedTasks();
      const archivedOnly = data.filter(t => t.is_archived === true);
      setArchivedTasks(archivedOnly);
      setShowArchivedPopup(true);
    } catch (e) {
      console.error(e);
      alert("Failed to load archived tasks: " + e.message);
    }
  }

  // add icon
  const [toasts, setToasts] = useState([]);
  // show for 3 s
  function pushToast({ type = "info", title, desc = "", duration = 3500, icon = null }) {
    const id = (crypto?.randomUUID?.() ?? String(Date.now() + Math.random()));
    setToasts((t) => [...t, { id, type, title, desc, icon }]);
    setTimeout(() => setToasts((t) => t.filter(x => x.id !== id)), duration)
  }

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
      <HeaderSection/>
      {/* Hidden input for Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleImportChange}
        className="hidden"
      />

      <DrawerPanel
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          user={user}
          timetableRef={timetableRef}
          activeMenu = {activeMenu}
          tasksRef = {tasksRef}
          handleShowArchived = {handleShowArchived}
          handleClearEvents = {handleClearEvents}
          events = {events}
          handleCellClick = {handleCellClick}
          handleEventClick = {handleEventClick}
          tasksLoading = {tasksLoading}
          taskObjects ={taskObjects}
          handleUpdateTask = {handleUpdateTask}
          archiveTask = {archiveTask}
          subjects = {subjects}
          toasts = {toasts}
          setToasts={setToasts}
          onImport={handleImportClick}
          onExport={handleExportClick}
          importBusy={importBusy}
          exportBusy={exportBusy}
      />

      {/* Modal */}
      <EventModal
        open={modalOpen}
        initial={modalInitial}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        subjectOptions={subjectOptions}
        existingEvents={events}
      />


      {/* Archived Tasks Popup */}
      {showArchivedPopup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]">
          <div className="bg-neutral-900 text-white w-[90vw] max-w-3xl rounded-xl p-6 shadow-lg relative">
            <button
              onClick={() => setShowArchivedPopup(false)}
              className="absolute top-3 right-3 text-xl font-bold"
            >
              ✕
            </button>

            <h2 className="text-2xl font-semibold mb-4">Archived Tasks</h2>

            {/* Search Bar */}
            <input
              type="text"
              placeholder="Search archived tasks..."
              className="w-full mb-4 px-3 py-2 rounded bg-neutral-800 text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {(() => {
              const SubjectMap = Object.fromEntries(subjects.map(s => [s.id, s.name]));

              // filter based on query but never mutate original state
              const filtered = archivedTasks.filter(t =>
                t.title.toLowerCase().includes(searchQuery.toLowerCase())
              );

              return (
                <div className="max-h-[60vh] overflow-y-auto space-y-3">
                  {filtered.map((task) => {
                    const subjectName = SubjectMap[task.subject] || "Unknown Subject";
                    const dueDate = task.due_at ? new Date(task.due_at) : null;
                    const formattedDue =
                      dueDate && !isNaN(dueDate)
                        ? dueDate.toLocaleString(undefined, {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                        : "No due date";

                    return (
                      <div
                        key={task.id}
                        className="p-4 rounded-lg bg-neutral-800 flex flex-col sm:flex-row sm:items-center sm:justify-between hover:bg-neutral-700 transition-colors"
                      >
                        {/* LEFT SIDE */}
                        <div className="min-w-0 flex-1 mb-3 sm:mb-0">
                          <div className="font-semibold truncate">
                            {subjectName} — {task.title}
                          </div>
                          <div className="text-sm opacity-70">Due: {formattedDue}</div>
                        </div>
                      </div>
                    );
                  })}

                  {filtered.length === 0 && (
                    <div className="text-center opacity-70 py-5">No archived tasks found.</div>
                  )}
                </div>
              );
            })()}


          </div>
        </div>
      )}

    </div>
  );
}

