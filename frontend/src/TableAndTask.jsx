import React, { useEffect, useMemo, useRef, useState, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import uniplanLogo from "./assets/uniplanLogo.svg";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const API = BASE_URL;

const authHeader = () => {
  const t = localStorage.getItem("jwt");
  return t ? { Authorization: `Bearer ${t}` } : {};
};

async function get(path) {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { ...authHeader() },
  });
  if (!r.ok) throw new Error(`GET ${path} failed (${r.status}): ${await r.text().catch(() => "")}`);
  return r.json();
}

async function post(path, body) {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${path} failed (${r.status}): ${await r.text().catch(() => "")}`);
  return r.json();
}

async function patch(path, body) {
  const r = await fetch(`${API}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH ${path} failed (${r.status})`);
  return r.json();
}

async function del(path) {
  const r = await fetch(`${API}${path}`, {
    method: "DELETE",
    credentials: "include",
    headers: { ...authHeader() },
  });
  if (!r.ok && r.status !== 204) throw new Error(`DELETE ${path} failed (${r.status})`);
}

async function listTimetable() {
  return get(`/api/timetable/?ordering=day_of_week,start_time`);
}
async function listSubjects() {
  return get(`/api/subjects/`);
}

async function whoami() {
  // returns { id, username, email, ... } when logged in, or {} if anonymous
  return get(`/api/whoami/`);
}

async function createSubject(name) {
  const subjectsNow = await listSubjects();
  const code = uniqueCodeFromName(name, subjectsNow);
  return post(`/api/subjects/`, { name, code }); // server sets user
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

async function sendTestEmail() {
  const r = await fetch(`${API}/api/test-email/`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeader() },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || `POST /api/test-email/ failed (${r.status})`);
  return data;
}


// Create a scheduled email reminder for an assignment
async function createReminder({
  assignmentId,
  remindAtISO,
  offsetDays,
}) {
  return post(`/api/reminders/intake/`, {
    assignmentId,
    remindAtISO,
    offsetDays,
  });
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


const toHHMM = (m) => {
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}; // It converts a number of minutes since midnight into “HH:MM” for dropdown label also on eventcard

const toLabelSS = (m) => `${toHHMM(m)}:00`;   // "HH:MM:SS" (08.15.00) for Django

// For hour-based grid snapping(grid still the same for hr)
const startHour = (m) => Math.floor(m / 60);                 // e.g. 08:15 -> 8
const endHour = (mStart, mEnd) =>
  Math.max(Math.ceil(mEnd / 60), Math.floor(mStart / 60) + 1); // at least 1h wide


const parseHHMM = (s) => {
  if (!s) return 0;
  const [H, M] = String(s).split(":").map(Number);
  return (H || 0) * 60 + (M || 0);  // convert hours/minutes to total minutes for easy math
}


// split hour and min
const getHour = (m) => Math.floor(m / 60);
const getMinute = (m) => m % 60;

// options for hour/minute selects
const HOURS = Array.from({ length: DAY_END_H - DAY_START_H + 1 }, (_, i) => DAY_START_H + i);
const MINUTES = Array.from({ length: 60 / STEP_MIN }, (_, i) => i * STEP_MIN);


// help for adjust the column card
const COL_W = 120;
const startOffsetPx = (mStart) => ((mStart % 60) / 60) * COL_W;
const endTrimPx = (mEnd) =>
  (mEnd % 60 === 0 ? 0 : (1 - (mEnd % 60) / 60) * COL_W);


// --- Linking assignments to timetable events ---
function norm(s) {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// returns { linked, day, color, eventTitle }
function linkOneAssignmentToEvents(assignment, events) {
  const aCourse = norm(assignment.courseName);
  const aTitle = norm(assignment.title);

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
function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d) ? "—" : d.toLocaleString();
}
function fmtDueDateObj(d) {
  if (!d || isNaN(+d)) return "—";
  return d.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


/* ----------------- time/day ----------------- */
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const TIMES = Array.from({ length: 12 }, (_, i) => 8 + i); // 08..19
const colFromTime = (h) => (h - 8) + 2;   // 8 -> col 2, 19 -> 13
const rowFromDay = (d) => d + 2;         // 0..6 -> rows 2..8



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
  const LABEL_W = 132; // first column day label
  const GAP = 2; // space between each grid cell(px)
  const COL_W = 120; // fixed column width of each time column (px)

  // Fixed total size (so it never shrinks)
  const TOTAL_W = LABEL_W + 12 * COL_W + 13 * GAP; // 13 columns, 12 gaps
  const TOTAL_H = HEADER_H + 7 * ROW_H + 8 * GAP; // 8 rows, 7 gaps

  return (
    <div className="rounded-xl bg-neutral-800 p-2  w-full h-full">
      {/* scroll container (adds scrollbars when needed) */}
      <div className="relative overflow-auto w-full h-full max-h-[75vh] scrollbar-transparent" style={{ WebkitOverflowScrolling: "touch" }}>
        {/* fixed-size grid that does NOT shrink */}
        <div
          className="relative grid gap-[2px] select-none w-full"
          style={{
            width: `${TOTAL_W}px`,
            height: `${TOTAL_H}px`,
            gridTemplateRows: `${HEADER_H}px repeat(7, ${ROW_H}px)`,
            gridTemplateColumns: `${LABEL_W}px repeat(12, ${COL_W}px)`, // fixed px columns (no fr)
          }}
          role="grid"
          aria-label="Weekly timetable"
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
              className="relative" // ahchor for absolute child
              style={{
                gridRow: rowFromDay(e.day),
                // keep grid hour-based (snap to hours)
                gridColumn: `${colFromTime(startHour(e.start))} / ${colFromTime(endHour(e.start, e.end))}`,
                zIndex: 10,
                overflow: "hidden", // keeps the card clipped inside the span
              }}
              // show real minutes
              title={`${e.title} — ${toHHMM(e.start)}–${toHHMM(e.end)}`}
            >
              {/* the card inside slide it on horizontal*/}
              <div
                className={`absolute top-0 bottom-0 rounded-md text-black p-2 text-xs font-semibold ${e.color || "bg-emerald-400"} cursor-pointer hover:opacity-90 overflow-hidden`}
                style={{
                  left: `${startOffsetPx(e.start)}px`,   // e.g., 30/60/90 px for :15/:30/:45
                  right: `${endTrimPx(e.end)}px`,         // trim right side if ends mid-hour
                }}>

                <div className="truncate whitespace-nowrap overflow-hidden">
                  {(e.title)}
                </div>
                <div className="text-[10px] opacity-80">
                  {toHHMM(e.start)}–{toHHMM(e.end)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// !! Didn't Use !!
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

// !! Didn't Use !!
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

function AssignmentsBoard({ TaskObjects, onUpdateTask, SubjectObjects, events }) {

    // console.log("-------------------------------------------------------");
    // console.log(TaskObjects);
    // console.log(SubjectObjects);
    // console.log("-------------------------------------------------------");

    //Legend Deadline indicator (Array)
    const legends = [
        { color: "bg-red-600", label: "less than 3 days" },
        { color: "bg-amber-400", label: "less than 7 days" },
        { color: "bg-green-400", label: "more than 7 days" },
    ];
    // Make Subject ID to be Key for easier to use Subject data
    const SubjectMap = useMemo(() => {
        const map = {};
        SubjectObjects.forEach(subj => {
            map[subj.id] = subj;
        });
        return map;
    }, [SubjectObjects]);


    //Search Bar (React Hook)
    const [searchTerm, setSearchTerm] = useState("");

    //4 Filters option (React Hook)
    const [appliedPriorityFilters, setAppliedPriorityFilters] = useState([]);
    const [appliedSubjectFilters, setAppliedSubjectFilters] = useState([]);
    const [appliedSourceFilters, setAppliedSourceFilters] = useState([]);

    //Group by dropdown (React Hook)
    const [groupByOption, setGroupByOption] = useState("");

    //Data filtered by Search Bar & Filter Button
    const filteredTasks = useMemo(() => {
        let result = [...TaskObjects];

        // Get data from each filter then merge later
        let matches = [];

        if (appliedPriorityFilters.length > 0) {
            matches.push(
                ...TaskObjects.filter(task => appliedPriorityFilters.includes(task.priority))
            );
        }
        if (appliedSubjectFilters.length > 0) {
            matches.push(
                ...TaskObjects.filter(task => appliedSubjectFilters.includes(task.subject))
            );
        }
        if (appliedSourceFilters.length > 0) {
            matches.push(
                ...TaskObjects.filter(task => appliedSourceFilters.includes(task.source))
            );
        }

        // check do any checkbox got marked
        const hasActiveFilters = appliedPriorityFilters.length > 0 || appliedSubjectFilters.length > 0 ||
                                          appliedSourceFilters.length > 0;

        if (hasActiveFilters) {
            if (matches.length > 0) {
                // merge & remove duplicates by id
                const unique = {};
                matches.forEach(task => (unique[task.id] = task));
                result = Object.values(unique);
            } else {
                // filters active but no matches => show nothing
                result = [];
            }
        } else {
            // no filters checked => show all
            result = [...TaskObjects];
        }

        // Filter out archived tasks
        result = result.filter(task => !task.is_archived);

        //  Search filter
        if (searchTerm) {
            result = result.filter(task =>
                task.title.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }


        return result;
    }, [TaskObjects, searchTerm, appliedPriorityFilters, appliedSubjectFilters, appliedSourceFilters]);



    //Create Separate Group each one has it own set of data
    const groupedTasks = useMemo(() => {
        if (groupByOption === "") return { "": filteredTasks };

        const group = (taskValue) => Object.fromEntries(groupBy(filteredTasks, taskValue));
        const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

        switch (groupByOption) {
            case "timetable":
                return group();


            case "day":
                return group((t) => dayNames[t.day_of_week] || "Unassigned");
            case "subject":
                return group((t) => {
                    const subj = SubjectMap[t.subject];
                    return subj ? subj.name : "Unknown Subject";
                });
            case "priority":
                return group((t) => t.priority || "Unknown");
            default:
                return { "": filteredTasks };
        }
    }, [filteredTasks, groupByOption, SubjectMap]);

    return(
        <div>

            {/*Utility buttons: Search bar + Filter + Group*/}
            <TaskFilterElements
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                groupByOption={groupByOption}
                setGroupByOption={setGroupByOption}
                SubjectObjects={SubjectObjects}
                setAppliedPriorityFilters={setAppliedPriorityFilters}
                setAppliedSubjectFilters={setAppliedSubjectFilters}
                setAppliedSourceFilters={setAppliedSourceFilters}
            />


            {/* Colors legend : tell how far from deadline*/}
            <div className="bg-pink-500 flex flex-col md:flex-row items-center gap-3 md:gap-6">
                {legends.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full ${item.color}`}/>
                        <span className="text-sm font-medium">{item.label}</span>
                    </div>
                ))}
            </div>


            <div>
                {Object.entries(groupedTasks).map(([label, tasks]) => (
                    <AssignmentsGroup key={label} label={label} GroupedTasks={tasks} SubjectMap={SubjectMap}
                                      onUpdateTask={onUpdateTask} events={events}/>
                ))}
            </div>


        </div>
    );
}

function AssignmentsGroup({ label, GroupedTasks, SubjectMap, onUpdateTask, events }) {
    const [isOpen, setIsOpen] = useState(true);

    if (GroupedTasks.length === 0) {
        return (
            <section className="space-y-6">
                <div className="text-lg opacity-70 py-2">No tasks to show.</div>
            </section>
        );
    }

    return (
        <div>
            {/* Header with toggle button */}
            <div className="flex items-center justify-start mb-2">
                {label && (
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="px-3 text-sm text-blue-200 hover:text-white transition"
                    >
                        {isOpen ? "⏷" : "▶"}
                    </button>
                )}

                <h2 className="text-lg font-bold uppercase">{label}</h2>

            </div>

            {/* Tasks list (conditionally rendered) */}
            {isOpen && (
                <div>
                    {GroupedTasks.map((task) => (
                        <AssignmentsCard key={task.id} task={task}  SubjectMap={SubjectMap} onUpdateTask={onUpdateTask}
                                         events = {events}/>
                    ))}
                </div>
            )}
        </div>
    );
}


function AssignmentsCard({ task, SubjectMap, onUpdateTask, events }) {

    // Data tell task linked with Timetable or not?
    const TableLink = linkOneAssignmentToEvents(task, events);

    const days_left = task.days_left;

    const leftText =
        days_left == null ? "—" : `${Math.max(days_left, 0)} Day${Math.abs(days_left) === 1 ? "" : "s"} Left`;
    // TODO: leftText = 0 Days Left

    const linked = TableLink?.linked;
    // Sample data true, false

    const dayBg =
        days_left != null
            ? days_left < 3
                ? "bg-red-500"     // urgent (<3 days)
                : days_left < 7
                    ? "bg-yellow-400"  // moderate (<7 days)
                    : "bg-green-500"   // safe (>7 days)
            : "";
    const dayRing =
        days_left != null
            ? days_left < 3
                ? "ring-red-400"     // urgent (<3 days)
                : days_left < 7
                    ? "ring-yellow-200"  // moderate (<7 days)
                    : "ring-green-300"   // safe (>7 days)
            : "";

    const [pending, setPending] = useState({});     // { [assignmentId]: boolean }
    const [choice, setChoice] = useState({});       // { [assignmentId]: 1|3|7 }
    const [scheduled, setScheduled] = useState({}); // { [assignmentId]: true }

    const format_due = task.due_at instanceof Date ? task.due_at : new Date(task.due_at);
    // get object that has the same key with this task
    const subject = SubjectMap[task.subject];

    const scheduleReminder = async (task) => {
        if (!task?.due_at) { alert("No due date for this task."); return; }

        const id = task.id;
        console.log(id);
        const due = task.due_at instanceof Date ? task.due_at : new Date(task.due_at);
        if (isNaN(+due)) { alert("Invalid due date."); return; }

        const offset = Number(choice[id] ?? 3); // default 3 days
        const remindAt = new Date(due.getTime() - offset * 24 * 60 * 60 * 1000);


        try {
            setPending(p => ({ ...p, [id]: true }));
            await createReminder({
                assignmentId: id,
                remindAtISO: remindAt.toISOString(),
                offsetDays: offset,
            });
            setScheduled(s => ({ ...s, [id]: true }));
            alert(`Reminder set: ${offset} day(s) before due date.`);
        } catch (e) {
            console.error(e);
            alert(`Failed to schedule reminder: ${e?.message || e}`);
        } finally {
            setPending(p => ({ ...p, [id]: false }));
        }
    };

    return (
        <div
            key={task.id}
            className={`my-3 grid grid-cols-[160px,1fr] rounded-xl border border-white/10 ring-1 ${dayRing} bg-white/5 overflow-hidden`}
        >
            {/* Left label (day color only when linked) */}
            <div className={`${dayBg} text-neutral-900 font-bold flex items-center justify-center p-3`}>
                <div className="text-center text-xl">{leftText}</div>
            </div>

            {/* Right content */}
            <div className="p-4 min-w-0">
                <div className="flex items-center justify-between gap-3">
                    <div className="text-sm opacity-80 truncate">
                        <span className="tracking-wider">{subject.name || "Loading..."}</span>
                        {task.assignment_alt_link && linked? (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-neutral-800 border border-white/10">
                              {task.title}
                            </span>
                        ) : null}
                    </div>
                </div>

                {/* Title (if linked, show the “HW:” line; if not linked, show note) */}
                {task.external_id ? (
                    <div className="mt-1 text-sm">
                        <span className="opacity-80 mr-2">HW:</span>
                        <span className="font-semibold">{task.title}</span>
                    </div>
                ) : (
                    <div className="mt-1 text-sm opacity-50 italic">Not assigned on timetable</div>
                )}

                {/* Due date & time (show when available) */}
                {format_due && (
                    <div className="mt-1 text-xs opacity-80">
                        <span className="font-semibold">Due:</span>{" "}
                        {fmtDueDateObj(format_due)}
                    </div>
                )}


                <div className="mt-3 flex items-center gap-3">
                    {task.altLink && (
                        <a
                            href={task.altLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-green-600 hover:bg-green-700 font-semibold"
                            title="Open in Classroom"
                        >
                            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-black/70" />
                            Classroom
                        </a>
                    )}

                    {/*Reminder controls */}
                    <div className="flex items-center gap-2">
                        <label className="text-xs opacity-75">Remind me:</label>
                        <select
                            className="text-xs rounded-full bg-neutral-800 border border-white/10 px-2 py-1 outline-none"
                            value={(choice[task.id] ?? 3)}
                            onChange={(e) => setChoice(c => ({ ...c, [task.id]: Number(e.target.value) }))}
                            disabled={!task.due_at || scheduled[task.id] || pending[task.id]}
                            title={task.due ? "Choose how many days before due date" : "No due date"}
                        >
                            <option value={1}>1 day before</option>
                            <option value={3}>3 days before</option>
                            <option value={7}>7 days before</option>
                        </select>
                        <button
                            onClick={() => scheduleReminder(task)}
                            disabled={!task.due_at || scheduled[task.id] || pending[task.id]}
                            className={[
                                "text-xs px-3 py-1.5 rounded-full font-semibold",
                                scheduled[task.id] ? "bg-neutral-700 cursor-default" : "bg-emerald-700 hover:bg-emerald-800",
                            ].join(" ")}
                            title={!task.due_at ? "No due date" : (scheduled[task.id] ? "Already scheduled" : "Schedule email reminder")}
                        >
                            {scheduled[task.id] ? "Scheduled" : (pending[task.id] ? "Scheduling..." : "Remind")}
                        </button>
                    </div>

                    {/*Priority controls*/}
                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs opacity-75">priority:</span>
                        <select
                            className="bg-neutral-800 border border-white/10 text-xs opacity-75"
                            value={task.priority ?? "none"}
                            onChange={(e) => onUpdateTask(task.id, { priority: e.target.value })}
                        >
                            <option value="none">-</option>
                            <option value="low">Low</option>
                            <option value="normal">Medium</option>
                            <option value="high">High</option>
                        </select>

                    </div>
                </div>

            </div>
        </div>
    );
}


function TaskFilterElements({searchTerm, setSearchTerm, groupByOption, setGroupByOption, SubjectObjects,
                                setAppliedPriorityFilters, setAppliedSubjectFilters, setAppliedSourceFilters}) {

    const [priorityFilters, setPriorityFilters] = useState([]);
    const [subjectFilters, setSubjectFilters] = useState([]);
    const [sourceFilters, setSourceFilters] = useState([]);
    const [daysLeftFilters, setDaysLeftFilters] = useState([]);


    // Filter Button Utility
    const toggleDropdown = () => setIsOpen(!isOpen);
    const [isOpen, setIsOpen] = useState(false);


    // Filter function logic
    const togglePriority = (priority_value) => {
        setPriorityFilters((prev) =>
            prev.includes(priority_value)
                ? prev.filter((p) => p !== priority_value)
                : [...prev, priority_value]
        );
    };
    const toggleSubject = (subject_value) => {
        setSubjectFilters((prev) =>
            prev.includes(subject_value)
                ? prev.filter((p) => p !== subject_value)
                : [...prev, subject_value]
        );
    };
    const toggleSource = (source_value) => {
        setSourceFilters((prev) =>
            prev.includes(source_value)
                ? prev.filter((p) => p !== source_value)
                : [...prev, source_value]
        );
    };


    const ClearFilters = () => {
        setSearchTerm("");
        setPriorityFilters([]);
        setSubjectFilters([]);
        setSourceFilters([]);
        setDaysLeftFilters([]);
        setAppliedPriorityFilters([]);
        setAppliedSubjectFilters([]);
        setAppliedSourceFilters([]);
        setGroupByOption("");
    };

    useEffect(() => {
        const handleClickOutside = () => setIsOpen(false);
        if (isOpen) document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [isOpen]);

    return (
        <div className="flex flex-col md:flex-row items-center justify-start gap-4 py-3">

            {/*Search Bar*/}
            <input
                type="text"
                placeholder="Search tasks by title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-[38%] p-1.5 border rounded-lg focus:outline-none focus:ring focus:ring-blue-950 text-sm text-blue-950"
            />


            {/*Filter Button*/}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen((prev) => !prev);
                }}
                className="relative px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
            >
                Filter
                <span className="ml-2"> ⏷ </span>

                {/*Logic when the pop-up open*/}
                {isOpen && (
                    <div className=" my-5 flex flex-col absolute w-[500px] bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-10"
                         onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-start ps-2 pb-5">
                            {["none", "low", "normal", "high"].map((priority_value) => (
                                <label
                                    key={priority_value}
                                    className=" items-center gap-2 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={priorityFilters.includes(priority_value)}
                                        onChange={() => togglePriority(priority_value)}
                                        className="rounded text-pink-500 focus:ring-pink-400"
                                    />
                                    <span className="capitalize">{priority_value}</span>
                                </label>
                            ))}
                        </div>

                        <div className="flex flex-col items-start ps-2 pb-5">
                            {SubjectObjects.map((subject) => (
                                <label
                                    key={subject.id}
                                    className="items-center gap-2 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={subjectFilters.includes(subject.id)}
                                        onChange={() => toggleSubject(subject.id)}
                                        className="rounded text-pink-500 focus:ring-pink-400"
                                    />
                                    <span className="capitalize">{subject.name}</span>
                                </label>
                            ))}
                        </div>

                        <div className="flex flex-col items-start ps-2 pb-5">
                            {["classroom", "create"].map((source_value) => (
                                <label
                                    key={source_value}
                                    className="items-center gap-2 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={sourceFilters.includes(source_value)}
                                        onChange={() => toggleSource(source_value)}
                                        className="rounded text-pink-500 focus:ring-pink-400"
                                    />
                                    <span className="capitalize">{source_value}</span>
                                </label>
                            ))}
                        </div>

                        <button
                            onClick={() => {
                                setAppliedPriorityFilters(priorityFilters);
                                setAppliedSubjectFilters(subjectFilters);
                                setAppliedSourceFilters(sourceFilters);
                                toggleDropdown();
                            }}
                            className="m-3 px-3 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition"
                        >
                            Apply Filter
                        </button>

                    </div>
                )}
            </button>


            {/*GroupBy Drop-box*/}
            <select
                value={groupByOption}
                onChange={(e) => setGroupByOption(e.target.value)}
                className="p-2 rounded bg-red-400 shadow"
            >
                <option value="none">-</option>
                <option value="day">By Due on</option>
                <option value="subject">By Subject</option>
                <option value="priority">By Urgency</option>
            </select>


            {/*Clear filter Button*/}
            <button
                onClick={ClearFilters}
            >
                Clear all
            </button>


        </div>
    )
}


function groupBy(filteredTasks, taskValue) {
    // blank map
    const grouped_map = new Map();

    // get attribute value of each task (based on what we group by)
    filteredTasks.forEach((item) => {
        // create Key
        const key = taskValue(item);
        // Check do key exist
        if (!grouped_map.has(key)) {
            grouped_map.set(key, []);
        }
        grouped_map.get(key).push(item);
    });
    return grouped_map;
}




/* ----------------- Modal form (Subject combo box from API) -------------------- */
function EventModal({ open, initial, onClose, onSave, onDelete, subjectOptions, existingEvents = [] }) {
  const [title, setTitle] = useState(initial.title || "");
  const [day, setDay] = useState(initial.day ?? 0);
  const [start, setStart] = useState(initial.startMin ?? DAY_START_H * 60); // store minute since midnight 480 min (8 am)
  const [end, setEnd] = useState(initial.endMin ?? (DAY_START_H * 60 + STEP_MIN)); // 495 minutes (8:15 am)
  const [desc, setDesc] = useState(initial.desc || "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(initial.title || "");
    setDay(initial.day ?? 0);
    setStart(initial.startMin ?? DAY_START_H * 60);
    setEnd(initial.endMin ?? Math.min((initial.startMin ?? DAY_START_H * 60) + STEP_MIN, DAY_END_H * 60));
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
                {MINUTES.filter(m => getHour(end) < DAY_END_H || m == 0).map(m => (
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
  }, [me?.id, meLoading]);


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
      }

      setModalOpen(false);
    } catch (err) {
      console.error(err);
      alert(`Save failed: ${err.message || err}`);
    }
  };



  const handleDeleteEvent = async (id) => {
    try {
      if (typeof id === "number") {
        await deleteTimetableEntry(id);
      }
      setEvents(prev => prev.filter(e => e.id !== id));
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      alert(`Delete failed: ${err.message || err}`);
    }
  };


  const handleClearEvents = async () => {
    try {
      const ids = events.filter(e => typeof e.id === "number").map(e => e.id);
      await Promise.allSettled(ids.map(id => deleteTimetableEntry(id)));
      setEvents([]);
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      alert(`Clear failed: ${err.message || err}`);
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
        <div className="w-full pl-5 sm:pl-6 lg:pl-8 pr-5 sm:pr-6 lg:pr-8 flex items-center justify-between">

          {/* LEFT: Logo on top, Menu under it */}
          <div className="flex flex-col items-start gap-2">
            <img
              src={uniplanLogo}
              alt="Uniplan Logo"
              className="h-[clamp(20px,6vh,50px)] w-auto"
            />

          </div>


          <div className="flex items-center gap-6">
            <Link to="/about" state={{ from: "/tableandtask" }} className="opacity-90 text-sm hover:underline">Contact</Link>
            <button
              className="border rounded-lg px-3 py-2" //  clear local data
              onClick={() => { localStorage.clear(); nav("/", { replace: true }); }}  // go to home and replace current history entry
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="sticky z-50 pl-2"
        style={{ top: "calc(var(--header-h, 72px))" }} // this is offset from the top equal to header height (default 72px) prevent overlapp with header

      >
        <div className="pl-5 sm:pl-6 lg:pl-8 pr-5 sm:pr-6 lg:pr-8 py-2">

          <button
            onClick={() => setMenuOpen(true)}
            className="inline-flex items-center gap-2 border rounded-lg px-3 py-2 text-sm"
            aria-expanded={menuOpen}
            aria-controls="app-drawer"
            title="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M3 6h18v2H3zM3 11h18v2H3zM3 16h18v2H3z" />
            </svg>
          </button>

        </div>
      </div>



      {/* Layout: [CENTER MENU CARD][RIGHT MAIN] */}
      <div className="mx-auto max-w-[1800px] 2xl:max-w-[2000px] px-4 sm:px-6 lg:px-8">
        <div className="pb-10 grid grid-cols-1 gap-y-6 items-start min-w-0">
          <main className="space-y-6 min-w-0">
            {/* actions / timetable / assignments / tasks*/}


          </main>



          {/* Drawer overlay */}
          <div
            className={`fixed inset-0 z-50 ${menuOpen ? 'visible bg-black/50' : 'invisible bg-black/0'} transition-colors`}
            onClick={() => setMenuOpen(false)}
          />

          {/* Drawer panel */}
          <aside
            id="app-drawer"
            className={[
              "fixed inset-y-0 left-0 z-50 w-[352px] max-w-[85vw]",
              "bg-neutral-800 text-white shadow-2xl",
              "transform transition-transform duration-300",
              menuOpen ? "translate-x-0" : "-translate-x-full",
              "flex flex-col p-4"
            ].join(" ")}
            role="dialog"
            aria-modal="true"
            aria-label="Sidebar menu"
          >
            {/* Header inside drawer */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 truncate">
                <div className="h-4 w-4 rounded-full bg-emerald-500" />
                <div className="font-semibold text-lg leading-tight truncate">
                  {user?.email || "student@gmail.com"}
                </div>
              </div>

              <button
                onClick={() => setMenuOpen(false)}
                className="inline-flex items-center justify-center rounded-md border px-3 py-2"
                aria-label="Close menu"
              >
                {/* X icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M18.3 5.71L12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.7 2.88 18.3 9.17 12 2.88 5.71 4.29 4.29 10.6 10.6l6.29-6.3z" />
                </svg>
              </button>
            </div>

            {/* Nav buttons*/}
            <nav className="space-y-3">
              <button
                onClick={() => {
                  timetableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  setMenuOpen(false);
                }}
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
                onClick={() => {
                  tasksRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  setMenuOpen(false);
                }}
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
            </nav>

          </aside>




          {/* RIGHT — timetable + tasks */}
          <main className="space-y-6 min-w-0">
            {/* actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={handleClearEvents}
                className="px-5 py-2 rounded-full bg-rose-500 hover:bg-rose-600 font-semibold"
                title="Clear"
              >
                Clear
              </button>
              <button className="px-5 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 font-semibold">
                Import
              </button>
              <button className="px-5 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 font-semibold">
                Export
              </button>

              {/* NEW: Send a test email */}
              <button
                onClick={async () => {
                  try {
                    const res = await sendTestEmail(); // <- uses the helper you added earlier
                    alert(res.detail || "Test email sent!");
                  } catch (e) {
                    console.error(e);
                    alert(e.message || "Failed to send test email");
                  }
                }}
                className="px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 font-semibold"
                title="Send a test email to your account email"
              >
                Send Test Email
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
                  // items={linkedAssignments}
                  TaskObjects={taskObjects}
                  onUpdateTask={handleUpdateTask}
                  SubjectObjects={subjects}
                  events={events}
              />
          </div>




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
        existingEvents={events}
      />
    </div>
  );
}