import React, { useState, useEffect } from "react";
import { post, del, get } from "/src/utils/api.js";
import { getTasks_Ring_BG_Color } from "/src/utils/color.js"
import { FULL_DAYS } from "/src/utils/time.js";
import SchoolIcon from '@mui/icons-material/School';
import ConfirmModal from "./assignmentConfirmModal.jsx";
import ArchiveIcon from '@mui/icons-material/Archive';
import GppMaybeIcon from '@mui/icons-material/GppMaybe';
import EventIcon from '@mui/icons-material/Event';
import EventBusyIcon from '@mui/icons-material/EventBusy';

export function AssignmentsCard({ task, SubjectMap, onUpdateTask, color, groupLabel, onArchiveTask, pushToast = () => { } }) {

    const subject = SubjectMap[task.subject];

    const days_left = task.days_left;

    const leftText =
        days_left == null ? "—" : `${Math.max(days_left, 0)} Day${Math.abs(days_left) === 1 ? "" : "s"} Left`;

    // check data linked to databased or not
    const linked = task.TableLink?.linked;

    const [dayBg, dayRing] = getTasks_Ring_BG_Color(days_left);

    const ringStyle = groupLabel !== "" ? { boxShadow: `0 0 0 2.5px ${color}` } : {};
    const ringClass = groupLabel === "" ? dayRing : "";

    const [choice, setChoice] = useState(3);       // { [assignmentId]: 1|3|7 }
    const [pending, setPending] = useState(false);     // { [assignmentId]: boolean }
    const [scheduled, setScheduled] = useState(false); // { [assignmentId]: true }
    const [reminder, setReminder] = useState(null);


    useEffect(() => {
        (async () => {
            const all = await getReminder();
            const r = all.find(x => x.task === task.id);
            if (r && r.status === "sent") {
                cancelReminder(r, task);
            }
            else {
                setReminder(r);
                setScheduled(!!r);
            }
        })();
    }, [task]);



    // parse due date
    // Force +7 hours (Bangkok)
    const format_due = (() => {
        if (!task.due_at) return null;

        const s = String(task.due_at).trim();
        if (!s) return null;

        try {
            const d = /(?:Z|[+\-]\d{2}:?\d{2})$/i.test(s) ? new Date(s) : new Date(s + "Z");
            return isNaN(+d) ? null : new Date(d.getTime() + 7 * 60 * 60 * 1000);
        } catch {
            return null;
        }
    })();


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


    const scheduleReminder = async () => {
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

        const offset = Number(choice ?? 3); // default 3 days
        console.log(choice);
        const remindAt = new Date(due.getTime() - offset * 24 * 60 * 60 * 1000);

        openConfirm({
            title: "Schedule reminder?",
            message: `Send a reminder ${offset} day(s) before due date`,
            confirmLabel: "Confirm",
            cancelLabel: "Cancel",
            onConfirm: async () => {
                setConfirm((s) => ({ ...s, loading: true }));

                try {
                    await postReminder(id, remindAt, offset);

                    pushToast({
                        type: "success",
                        title: "Reminder scheduled",
                        desc: `We'll remind you ${offset} day(s) before the due date for "${task.title}".`,
                        icon: <EventIcon sx={{ fontSize: 20 }} />,
                    });
                } catch (e) {

                    pushToast({
                        type: "error",
                        title: "Failed to schedule reminder",
                        desc: e?.message || "Something went wrong while scheduling the reminder.",
                        icon: <GppMaybeIcon sx={{ fontSize: 20 }} />,
                    });
                } finally {
                    setPending(false);
                    closeConfirm();
                }
            },
        });
    };

    async function postReminder(id, remindAt, offset) {
        setPending(true);
        try {
            await createReminder({
                assignmentId: id,
                remindAtISO: remindAt.toISOString(),
                offsetDays: offset,
            });
            const all = await getReminder();
            const r = all.find(remindObject => remindObject.task === task.id);
            setReminder(r);
            setScheduled(!!r);
        } finally {
            setPending(false);
        }
    }

    async function cancelReminder(del_reminder, _task) {
        setPending(true);
        try {
            await del(`/api/reminders/${del_reminder.id}/`);
            const all = await getReminder();
            const r = all.find(remindObject => remindObject.task === _task.id);

            setReminder(r);
            setScheduled(!!r);

            pushToast({
                type: "success",
                title: "Reminder cancelled",
                desc: `The reminder for "${_task.title}" has been cancelled.`,
                icon: <EventBusyIcon sx={{ fontSize: 20 }} />
            });
        } finally {
            setPending(false);
        }
    }


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
            className={`my-3 mr-4 grid grid-cols-[160px,1fr] rounded-xl border border-white/10 ring-1 ${ringClass} bg-white/5 overflow-y-hidden scrollbar-transparent`}
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
                            <span className="ml-2 text-xs px-2 py-0.4 rounded-full bg-neutral-800 border border-white/10">
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
                        {fmtDueDateObj(format_due)} <span className="opacity-60">(GMT+7)</span>
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
                            <span> <SchoolIcon fontSize="small" /> </span>
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
                            className="text-xs rounded-full bg-neutral-800 border border-white/10 px-2 py-1 outline-none "
                            value={(choice?? 3)}
                            onChange={(e) => setChoice(Number(e.target.value))}
                            disabled={!task.due_at || days_left < 0 || scheduled === true || pending === true}
                            title={task.due ? "Choose how many days before due date" : "No due date"}
                        >
                            <option value={1}>1 day before</option>
                            <option value={3}>3 days before</option>
                            <option value={7}>7 days before</option>
                        </select>

                        <button
                            onClick={() => {
                                console.log(scheduled);
                                if (scheduled === true) {
                                    cancelReminder(reminder, task);
                                } else {
                                    scheduleReminder();
                                }
                            }}
                            disabled={!task.due_at || days_left < 0 || pending === true}
                            className={[
                                "group relative flex items-center justify-center text-xs py-1.5 px-3 rounded-full font-semibold transition-colors duration-150",
                                scheduled === true
                                    ? days_left > 0
                                        ? "bg-white/10 hover:bg-transparent"
                                        : "bg-white/5 text-[#afafaf]"
                                    : days_left > 0
                                        ? "bg-emerald-800 hover:bg-emerald-900"
                                        : "bg-white/5 text-[#afafaf]"
                            ].join(" ")}
                            title={!task.due_at ? "No due date" : (scheduled === true ? "Already scheduled" : "Schedule email reminder")}
                        >
                            {scheduled ? (
                                days_left > 0 ? (
                                    <span className="relative block w-[60px] text-center ">
                                        {/* normal text */}
                                        <span
                                            className="
                                            transition-all duration-150
                                            group-hover:opacity-0
                                            group-hover:scale-90
                                            group-hover:-translate-x-1"
                                        >
                                            Scheduled
                                        </span>

                                        {/* hover text */}
                                        <span
                                            className="
                                            absolute -left-3 top-1/2 -translate-y-1/2
                                            bg-red-700 text-white text-xs font-semibold
                                            px-3 py-1.5 rounded-full
                                            opacity-0 group-hover:opacity-100
                                            transition-all duration-150"
                                        >
                                            Cancel
                                        </span>
                                      </span>
                                ) : (
                                    "Scheduled"
                                )
                            ) : pending ? (
                                "Scheduling..."
                            ) : (
                                "Remind"
                            )}
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

async function getReminder() {
    return get('/api/reminders/');
}
