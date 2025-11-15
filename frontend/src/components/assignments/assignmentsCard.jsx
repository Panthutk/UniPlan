import React, { useState } from "react";
import { post } from "/src/utils/api.js";
import { getTasks_Ring_BG_Color } from "/src/utils/color.js"
import { FULL_DAYS } from "/src/utils/time.js";
import SchoolIcon from '@mui/icons-material/School';
import ConfirmModal from "./assignmentConfirmModal.jsx";
import ArchiveIcon from '@mui/icons-material/Archive';
import GppMaybeIcon from '@mui/icons-material/GppMaybe';
import EventIcon from '@mui/icons-material/Event';
export function AssignmentsCard({ task, SubjectMap, onUpdateTask, color, groupLabel, onArchiveTask, pushToast = () => { } }) {

    const subject = SubjectMap[task.subject];

    const days_left = task.days_left;

    const leftText =
        days_left == null ? "—" : `${Math.max(days_left, 0)} Day${Math.abs(days_left) === 1 ? "" : "s"} Left`;

    // check data linked to databased or not
    const linked = task.TableLink?.linked;

    const [dayBg, dayRing] = getTasks_Ring_BG_Color(days_left);

    const ringStyle = groupLabel !== "" ? { boxShadow: `0 0 0 2px ${color}` } : {};
    const ringClass = groupLabel === "" ? dayRing : "";


    const [pending, setPending] = useState({});     // { [assignmentId]: boolean }
    const [choice, setChoice] = useState({});       // { [assignmentId]: 1|3|7 }
    const [scheduled, setScheduled] = useState({}); // { [assignmentId]: true }

    // parse due date
    const format_due = task.due_at instanceof Date ? task.due_at : new Date(task.due_at);


    // get object that has the same key with this task
    const lectureText = (() => {
        if (!task.TableLink?.days?.length) return null;

        if (task.TableLink.days.length === 7) {
            return "Lecture: entire week";
        } else if (task.TableLink.days.length === 1) {
            return `Lecture: ${FULL_DAYS[task.TableLink.days[0]]}`;
        } else {
            const names = task.TableLink.days
                .sort((a, b) => a - b)
                .map((d) => FULL_DAYS[d])
                .join(" / ");
            return `Lecture: ${names}`;
        }
    })();


    const scheduleReminder = async (task) => {
        if (!task?.due_at) {
            openConfirm({
                title: "No due date",
                message: "This task doesnt have a due date, so a reminder cant be scheduled.",
                confirmLabel: "OK",
                cancelLabel: "",
                onConfirm: closeConfirm,
            })
            return;
        }

        const id = task.id;
        const due = task.due_at instanceof Date ? task.due_at : new Date(task.due_at);
        if (isNaN(+due)) {

            openConfirm({
                title: "Invalid due date",
                message: "The due date is invalid",
                confirmLabel: "OK",
                cancelLabel: "",
                onConfirm: closeConfirm,
            })
            return;
        }

        const offset = Number(choice[id] ?? 3); // default 3 days
        const remindAt = new Date(due.getTime() - offset * 24 * 60 * 60 * 1000);

        openConfirm({
            title: "Schedule reminder?",
            message: `Send a reminder ${offset} day(s) before due date`,
            confirmLabel: "Confirm",
            cancelLabel: "Cancel",
            onConfirm: async () => {
                setConfirm((s) => ({ ...s, loading: true }));

                try {
                    setPending(p => ({ ...p, [id]: true }));
                    await createReminder({
                        assignmentId: id,
                        remindAtISO: remindAt.toISOString(),
                        offsetDays: offset,
                    });
                    setScheduled(s => ({ ...s, [id]: true }));

                    pushToast({
                        type: "success",
                        title: "Reminder scheduled",
                        desc: `We'll remind you ${offset} day(s) before the due date for "${task.title}".`,
                        icon: <EventIcon sx={{ fontSize: 20 }} />,
                    });
                } catch (e) {
                    console.error(e);

                    pushToast({
                        type: "error",
                        title: "Failed to schedule reminder",
                        desc: e?.message || "Something went wrong while scheduling the reminder.",
                        icon: <GppMaybeIcon sx={{ fontSize: 20 }} />,
                    });
                } finally {
                    setPending(p => ({ ...p, [id]: false }));
                    closeConfirm();
                }
            },
        });
    };






    const [confirm, setConfirm] = useState({
        open: false,
        title: "",
        message: "",
        loading: false,
        onConfirm: null,
        confirmLabel: "Confirm",
        cancelLabel: "Cancel",
    });

    const openConfirm = (cfg) => setConfirm({ open: true, loading: false, confirmLabel: "Confirm", cancelLabel: "Cancel", ...cfg });
    const closeConfirm = () => setConfirm((s) => ({ ...s, open: false, onConfirm: null }));

    return (
        <div
            key={task.id}
            className={`my-3 grid grid-cols-[160px,1fr] rounded-xl border border-white/10 ring-1 ${ringClass} bg-white/5 overflow-hidden`}
            style={ringStyle}
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
                        {task.assignment_alt_link && linked === true ? (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-neutral-800 border border-white/10">
                                {lectureText && (
                                    <span className="ml-2 text-xs opacity-70">{lectureText}</span>
                                )}
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



                {/*Classroom link button*/}
                <div className="mt-3 flex items-center gap-3">
                    {task.assignment_alt_link && (
                        <a
                            href={task.assignment_alt_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-[#18A15F] hover:bg-green-700 font-semibold"
                            title="Open in Classroom"
                        >
                            {/*<span className="inline-block h-2.5 w-2.5 rounded-sm bg-black/70" />*/}
                            <span> <SchoolIcon fontSize="small"/> </span>
                            Classroom
                        </a>
                    )}

                    {/*Priority controls*/}
                    <div className="flex items-center gap-2">
                        <span className="text-xs opacity-75">priority:</span>
                        <select
                            className="text-xs rounded-full bg-neutral-800 border border-white/10 px-2 py-1 outline-none"
                            value={task.priority ?? "none"}
                            onChange={(e) => onUpdateTask(task.id, { priority: e.target.value })}
                        >
                            <option value="none">-</option>
                            <option value="low">Low</option>
                            <option value="normal">Medium</option>
                            <option value="high">High</option>
                        </select>

                    </div>

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
                                scheduled[task.id] ? "bg-neutral-700 cursor-default" : "bg-emerald-800 hover:bg-emerald-900",
                            ].join(" ")}
                            title={!task.due_at ? "No due date" : (scheduled[task.id] ? "Already scheduled" : "Schedule email reminder")}
                        >
                            {scheduled[task.id] ? "Scheduled" : (pending[task.id] ? "Scheduling..." : "Remind")}
                        </button>
                    </div>
                    {/*Archive button*/}
                    <button
                        onClick={async () => {
                            openConfirm({
                                title: "Archive this task?",
                                message: `“${task.title}” will move to Archive. You can unarchive later.`,
                                onConfirm: async () => {
                                    setConfirm((s) => ({ ...s, loading: true }));

                                    try {
                                        await onArchiveTask(task.id);
                                        onUpdateTask(task.id, { is_archived: true });

                                        pushToast({
                                            type: "success",
                                            title: "Task archived",
                                            desc: `"${task.title}" has been moved to Archive.`,
                                            icon: <ArchiveIcon sx={{ fontSize: 20 }} />,
                                        });

                                    } catch (e) {
                                        console.error(e);

                                        pushToast({
                                            type: "error",
                                            title: "Archive failed",
                                            desc: e?.message || "Something went wrong while archiving this task.",
                                            icon: <GppMaybeIcon sx={{ fontSize: 20 }} />,
                                        })

                                    } finally {
                                        closeConfirm();
                                    }

                                },
                            });

                        }}
                        className="ml-auto text-xs px-3 py-1.5 rounded-full bg-gray-700 hover:bg-[#6D2B2C] font-semibold"
                        title="Archive this task"
                    >
                        Archive
                    </button>

                </div>

            </div>
            <ConfirmModal
                open={confirm.open}
                title={confirm.title}
                message={confirm.message}
                loading={confirm.loading}
                onCancel={closeConfirm}
                onConfirm={confirm.onConfirm || closeConfirm}
                confirmLabel={confirm.confirmLabel}
                cancelLabel={confirm.cancelLabel} />
        </div>
    );
}

// Create a scheduled email reminder for an assignment
async function createReminder({ assignmentId, remindAtISO, offsetDays, }) {
    return post(`/api/reminders/intake/`, {
        assignmentId,
        remindAtISO,
        offsetDays,
    });
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
        hour12: true
    });
}


