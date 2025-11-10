/* -----------------Assignments Board----------------- */
import React, { useEffect, useMemo, useState } from "react";
import { post } from '@/utils/api.js';

export function AssignmentsBoard({ TaskObjects, onUpdateTask, onArchiveTask, SubjectObjects, events }) {

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

    //5 Filters option (React Hook)
    const [appliedPriorityFilter, setAppliedPriorityFilter] = useState("");
    const [appliedSubjectFilter, setAppliedSubjectFilter] = useState("");
    const [appliedSourceFilter, setAppliedSourceFilter] = useState("");
    const [appliedDaysLeftFilter, setAppliedDaysLeftFilter] = useState("");
    const [appliedOnTimetableFilter, setAppliedOnTimetableFilter] = useState("");

    //Group by dropdown (React Hook)
    const [groupByOption, setGroupByOption] = useState("");

    //Add table link
    const TaskObjects_tableLinked = useMemo(
        () => annotateAssignmentsWithEvents(TaskObjects, events, SubjectMap),
        [TaskObjects, events, SubjectMap]
    );

    //Data filtered by Search Bar & Filter Button
    const filteredTasks = useMemo(() => {

        let result = [...TaskObjects_tableLinked];

        if (searchTerm) {
            result = result.filter(task =>
                task.title.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // must match all the selected to show the result
        if (appliedPriorityFilter) {
            result = result.filter(task => task.priority === appliedPriorityFilter);
        }
        if (appliedSubjectFilter) {
            result = result.filter(task => task.subject === appliedSubjectFilter);
        }
        if (appliedSourceFilter) {
            result = result.filter(task => task.source === appliedSourceFilter);
        }
        if (appliedDaysLeftFilter) {
            if (appliedDaysLeftFilter < 1000) {
                result = result.filter(task => task.days_left < appliedDaysLeftFilter);
            }
            else {
                result = result.filter(task => task.days_left >= 7);
            }
        }
        if (appliedOnTimetableFilter !== "") {
            result = result.filter(task => task.TableLink.linked === appliedOnTimetableFilter);
        }


        result = result.filter(task => !task.is_archived);

        return result;
    }, [TaskObjects_tableLinked, searchTerm, appliedPriorityFilter, appliedSubjectFilter, appliedSourceFilter,
        appliedDaysLeftFilter, appliedOnTimetableFilter]);


    //Create Separate Group each one has it own set of data
    const groupedTasks = useMemo(() => {
        if (groupByOption === "") return { "": filteredTasks };

        const group = (taskValue) => Object.fromEntries(TaskGroupBy(filteredTasks, taskValue));

        const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        switch (groupByOption) {
            case "day":
                return group((t) => dayNames[t.day_of_week] || "Unassigned");
            case "subject":
                return group((t) => {
                    const subj = SubjectMap[t.subject];
                    return subj ? subj.name : "Unknown Subject";
                });
            case "priority":
                return group((t) => {
                    if (t.priority === "normal") {
                        return "Medium";
                    }
                    else return t.priority || "Unknown";
                });
            case "lecture day":
                return group((t) => {
                    const days = t.TableLink?.days;
                    if (Array.isArray(days)) {
                        return days.map((i) => dayNames[i] || "Unassigned");
                    }
                    return dayNames[days] || "Unassigned";
                });


            default:
                return { "": filteredTasks };
        }
    }, [filteredTasks, groupByOption, SubjectMap]);

    return (
        <div>

            {/*Utility buttons: Search bar + Filter + Group*/}
            <TaskFilterElements
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                groupByOption={groupByOption}
                setGroupByOption={setGroupByOption}
                SubjectObjects={SubjectObjects}
                setAppliedPriorityFilter={setAppliedPriorityFilter}
                setAppliedSubjectFilter={setAppliedSubjectFilter}
                setAppliedSourceFilter={setAppliedSourceFilter}
                setAppliedDaysLeftFilter={setAppliedDaysLeftFilter}
                setAppliedOnTimetableFilter={setAppliedOnTimetableFilter}
            />


            {/* Colors legend : tell how far from deadline*/}
            <div className="flex flex-col md:flex-row items-center gap-3 md:gap-6">
                {legends.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full ${item.color}`} />
                        <span className="text-sm font-medium">{item.label}</span>
                    </div>
                ))}
            </div>

            <div>
                {sortGroups(groupedTasks, groupByOption).map(([label, tasks]) => (
                    <AssignmentsGroup
                        key={label}
                        label={label}
                        GroupedTasks={tasks}
                        SubjectMap={SubjectMap}
                        onUpdateTask={onUpdateTask}
                        onArchiveTask={onArchiveTask}
                        events={events}
                    />
                ))}
            </div>


        </div>
    );
}

function AssignmentsGroup({ label, GroupedTasks, SubjectMap, onUpdateTask, onArchiveTask }) {

    const [isOpen, setIsOpen] = useState(true);

    const colorMap = {
        Monday: "#f6e05e",
        Tuesday: "#f48fb1",
        Wednesday: "#4ade80",
        Thursday: "#f6ad55",
        Friday: "#63b3ed",
        Saturday: "#AC94FA",
        Sunday: "#F87171",
        none: "#FF9793",
        low: "#FF4B33",
        Medium: "#E72107",
        high: "#B21500",
        "": "#808080" // default
    };

    function getColor(label) {
        if (colorMap[label]) return colorMap[label];

        const subjectEntry = Object.values(SubjectMap).find(
            (subject) => subject.name === label
        );
        if (subjectEntry?.color_hex) return subjectEntry.color_hex;
        return "#808080";
    }

    const color = getColor(label);

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
                        className="px-3 text-sm hover:text-white transition"
                    >
                        {isOpen ? "⏷" : "▶"}
                    </button>
                )}

                <h2 className={`text-lg font-bold uppercase`} style={{ color }}>
                    {label}
                    {label !== "" && (
                        <span className="text-gray-400 text-base px-1">({GroupedTasks.length})</span>
                    )}
                </h2>

            </div>

            {/* Tasks list (conditionally rendered) */}
            {isOpen && (
                <div>
                    {GroupedTasks.map((task) => (
                        <AssignmentsCard
                            key={task.id}
                            task={task}
                            SubjectMap={SubjectMap}
                            onUpdateTask={onUpdateTask}
                            onArchiveTask={onArchiveTask}
                            color={color}
                            groupLabel={label}
                        />

                    ))}
                </div>
            )}
        </div>
    );
}


function AssignmentsCard({ task, SubjectMap, onUpdateTask, color, groupLabel, onArchiveTask }) {

    const subject = SubjectMap[task.subject];

    const days_left = task.days_left;

    const leftText =
        days_left == null ? "—" : `${Math.max(days_left, 0)} Day${Math.abs(days_left) === 1 ? "" : "s"} Left`;

    // check data linked to databased or not
    const linked = task.TableLink?.linked;

    const dayBg =
        days_left != null
            ? days_left < 3
                ? "bg-red-500"     // urgent (<3 days)
                : days_left < 7
                    ? "bg-yellow-400"  // moderate (<7 days)
                    : "bg-green-500"   // safe (>7 days)
            : "";
    // slightly color change from Background Colors
    const dayRing =
        days_left != null
            ? days_left < 3
                ? "ring-red-400"
                : days_left < 7
                    ? "ring-yellow-200"
                    : "ring-green-300"
            : "";

    const ringStyle = groupLabel !== "" ? { boxShadow: `0 0 0 1.5px ${color}` } : {};
    const ringClass = groupLabel === "" ? dayRing : "";


    const [pending, setPending] = useState({});     // { [assignmentId]: boolean }
    const [choice, setChoice] = useState({});       // { [assignmentId]: 1|3|7 }
    const [scheduled, setScheduled] = useState({}); // { [assignmentId]: true }

    const format_due = task.due_at instanceof Date ? task.due_at : new Date(task.due_at);
    // get object that has the same key with this task

    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    const lectureText = (() => {
        if (!task.TableLink?.days?.length) return null;

        if (task.TableLink.days.length === 7) {
            return "Lecture: entire week";
        } else if (task.TableLink.days.length === 1) {
            return `Lecture: ${dayNames[task.TableLink.days[0]]}`;
        } else {
            const names = task.TableLink.days
                .sort((a, b) => a - b)
                .map((d) => dayNames[d])
                .join(" / ");
            return `Lecture: ${names}`;
        }
    })();


    const scheduleReminder = async (task) => {
        if (!task?.due_at) { alert("No due date for this task."); return; }

        const id = task.id;
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
                            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-green-600 hover:bg-green-700 font-semibold"
                            title="Open in Classroom"
                        >
                            {/*<span className="inline-block h-2.5 w-2.5 rounded-sm bg-black/70" />*/}
                            <span> 👨🏻‍💻 </span>
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
                    {/*Archive button*/}
                    <button
                        onClick={async () => {
                            if (window.confirm("Archive this task?")) {
                                try {
                                    await onArchiveTask(task.id);
                                    onUpdateTask(task.id, { is_archived: true });
                                    alert("Task archived successfully!");
                                } catch (e) {
                                    console.error(e);
                                    alert("Failed to archive task: " + e.message);
                                }
                            }
                        }}
                        className="text-xs px-3 py-1.5 rounded-full bg-gray-700 hover:bg-gray-600 font-semibold"
                        title="Archive this task"
                    >
                        Archive
                    </button>

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


function sortGroups(groupedTasks, groupBy) {
    const orderMap = {
        day: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Unassigned"],
        "lecture day": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Unassigned"],
        priority: ["high", "medium", "low", "none", "unknown"],
    };

    const order = orderMap[groupBy];
    if (!order) return Object.entries(groupedTasks);

    return Object.entries(groupedTasks).sort(([a], [b]) => {
        const normalize = (str) => str?.toLowerCase()?.trim();
        const indexA = order.findIndex((d) => normalize(d) === normalize(a));
        const indexB = order.findIndex((d) => normalize(d) === normalize(b));
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
}



function TaskFilterElements({ searchTerm, setSearchTerm, groupByOption, setGroupByOption, SubjectObjects,
                                setAppliedPriorityFilter, setAppliedSubjectFilter, setAppliedSourceFilter,
                                setAppliedDaysLeftFilter, setAppliedOnTimetableFilter }) {

    // Filter Hooks
    const [priorityFilter, setPriorityFilter] = useState("");
    const [subjectFilter, setSubjectFilter] = useState("");
    const [sourceFilter, setSourceFilter] = useState("");
    const [daysLeftFilter, setDaysLeftFilter] = useState("");
    const [onTimetableFilter, setOnTimetableFilter] = useState("");

    // Filter Button Utility
    const toggleDropdown = () => setIsOpen(!isOpen);
    const [isOpen, setIsOpen] = useState(false);


    // Filter function logic
    const handlePriorityChange = (priority_value) => {
        setPriorityFilter(prev => prev === priority_value ? "" : priority_value);
    };
    const handleSubjectChange = (subject_value) => {
        setSubjectFilter(prev => prev === subject_value ? "" : subject_value);
    };
    const handleSourceChange = (source_value) => {
        setSourceFilter(prev => prev === source_value ? "" : source_value);
    };
    const handleDaysLeftChange = (daysLeft_value) => {
        setDaysLeftFilter(prev => prev === daysLeft_value ? "" : daysLeft_value);
    };
    const handleOnTimeableChange = (timetable_value) => {
        setOnTimetableFilter(prev => prev === timetable_value ? "" : timetable_value);
    };



    const ClearFilters = () => {
        setSearchTerm("");
        setPriorityFilter("");
        setSubjectFilter("");
        setSourceFilter("");
        setDaysLeftFilter("");
        setOnTimetableFilter("");
        setAppliedPriorityFilter("");
        setAppliedSubjectFilter("");
        setAppliedSourceFilter("");
        setAppliedDaysLeftFilter("");
        setAppliedOnTimetableFilter("");
        setGroupByOption("");
    };

    const due_date = [
        { value: 3, label: "less than 3 days" },
        { value: 7, label: "less than 7 days" },
        { value: 1000, label: "greater than or equal 7 days" },
    ];

    const tableLinked = [
        { value: true, label: "Yes" },
        { value: false, label: "No" },
    ]

    const PriorityShow = {
        "none": "none",
        "low": "low",
        "normal": "medium",
        "high": "high",
    }

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
                            Priority:
                            {["none", "low", "normal", "high"].map((priority_value) => (
                                <label
                                    key={priority_value}
                                    className=" items-center gap-2 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={priorityFilter === priority_value}
                                        onChange={() => handlePriorityChange(priority_value)}
                                        className="text-pink-500 focus:ring-pink-400"
                                    />
                                    <span className="capitalize">{PriorityShow[priority_value]}</span>
                                </label>
                            ))}
                        </div>

                        <div className="flex flex-col items-start ps-2 pb-5">
                            Subject:
                            {SubjectObjects.map((subject_value) => (
                                <label
                                    key={subject_value.id}
                                    className="items-center gap-2 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={subjectFilter === subject_value.id}
                                        onChange={() => handleSubjectChange(subject_value.id)}
                                        className="rounded text-pink-500 focus:ring-pink-400"
                                    />
                                    <span className="capitalize">{subject_value.name}</span>
                                </label>
                            ))}
                        </div>

                        <div className="flex flex-col items-start ps-2 pb-5">
                            Assignment Source:
                            {["classroom", "create"].map((source_value) => (
                                <label
                                    key={source_value}
                                    className="items-center gap-2 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={sourceFilter === source_value}
                                        onChange={() => handleSourceChange(source_value)}
                                        className="rounded text-pink-500 focus:ring-pink-400"
                                    />
                                    <span className="capitalize">{source_value}</span>
                                </label>
                            ))}
                        </div>

                        <div className="flex flex-col items-start ps-2 pb-5">
                            Due date in:
                            {due_date.map((daysLeft_value) => (
                                <label
                                    key={daysLeft_value.value}
                                    className="items-center gap-2 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={daysLeftFilter === daysLeft_value.value}
                                        onChange={() => handleDaysLeftChange(daysLeft_value.value)}
                                        className="rounded text-pink-500 focus:ring-pink-400"
                                    />
                                    <span className="capitalize">{daysLeft_value.label}</span>
                                </label>
                            ))}
                        </div>

                        <div className="flex flex-col items-start ps-2 pb-5">
                            Lecture on Timetable:
                            {tableLinked.map((timetable_value) => (
                                <label
                                    key={timetable_value.value}
                                    className="items-center gap-2 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={onTimetableFilter === timetable_value.value}
                                        onChange={() => handleOnTimeableChange(timetable_value.value)}
                                        className="rounded text-pink-500 focus:ring-pink-400"
                                    />
                                    <span className="capitalize">{timetable_value.label}</span>
                                </label>
                            ))}
                        </div>

                        <button
                            onClick={() => {
                                setAppliedPriorityFilter(priorityFilter);
                                setAppliedSubjectFilter(subjectFilter);
                                setAppliedSourceFilter(sourceFilter);
                                setAppliedDaysLeftFilter(daysLeftFilter);
                                setAppliedOnTimetableFilter(onTimetableFilter);
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
                <option value="day">By Due date</option>
                <option value="subject">By Subject</option>
                <option value="priority">By Priority</option>
                <option value="lecture day">By Lecture Day</option>
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


function TaskGroupBy(filteredTasks, getKey) {
    const grouped_map = new Map();

    filteredTasks.forEach((item) => {
        let key = getKey(item);

        if (Array.isArray(key)) {
            if (key.length === 0) key = ["Unassigned"];
        } else {
            key = [key];
        }

        key.forEach((k) => {
            const label =
                k === undefined || k === null || k === "" ? "Unassigned" : k;
            if (!grouped_map.has(label)) grouped_map.set(label, []);
            grouped_map.get(label).push(item);
        });
    });

    return grouped_map;
}

function annotateAssignmentsWithEvents(items, events, SubjectMap) {
    return (items || []).map((a) => {
        const link = linkOneAssignmentToEvents(a, events, SubjectMap[a.subject].name);
        return { ...a, TableLink: link };
    });
}

// --- Linking assignments to timetable events ---
function norm(s) {
    return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// returns { linked, day, color, eventTitle }
function linkOneAssignmentToEvents(assignment, events, subjectName) {
    const aCourse = norm(subjectName);
    const aTitle = norm(assignment.title);

    const daySet = new Set();
    const colorSet = new Set();

    for (const ev of events || []) {
        const eTitle = norm(ev.title);
        if (!eTitle) continue;

        const match =
            eTitle.includes(aCourse) ||
            aCourse.includes(eTitle) ||
            eTitle.includes(aTitle) ||
            aTitle.includes(eTitle);

        if (match) {
            daySet.add(ev.day);
            colorSet.add(colorForDay(ev.day));
        }
    }

    const days = [...daySet];
    const colors = [...colorSet];

    return {
        linked: days.length > 0,
        days,
        colors,
        subjectName,
    };
}

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