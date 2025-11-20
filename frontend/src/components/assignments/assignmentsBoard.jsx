import React, {useEffect, useMemo, useState} from "react";
import { TaskFilterElements } from "./assignmentsFilterButtons.jsx";
import { AssignmentsGroup, TaskGroupBy } from "./assignmentsGroup.jsx";
import { colorForDay } from "/src/utils/color.js"
import { FULL_DAYS } from "/src/utils/time.js";
import { get } from "/src/utils/api.js";


export function AssignmentsBoard({ TaskObjects, onUpdateTask, onArchiveTask, SubjectObjects, subjectOptions, events, pushToast, }) {

    const [reminders, setReminders] = useState([]);

    useEffect(() => {
        (async () => {
            const data = await getReminder();
            setReminders(data);
        })();
    }, [TaskObjects]);

    const reminderMap = useMemo(() => {
        const reminderMap = {};
        reminders.forEach(r => {
            reminderMap[r.task] = r;
        });
        return reminderMap;
    }, [reminders]);


    const ReverseTasks = useMemo(() => {
        return [...TaskObjects].reverse();
    }, [TaskObjects]);

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


    const [reverseSort, setReverseSort] = useState(false);

    //Search Bar (React Hook)
    const [searchTerm, setSearchTerm] = useState("");

    //5 Filters option (React Hook)
    const [appliedPriorityFilter, setAppliedPriorityFilter] = useState("");
    const [appliedSubjectFilter, setAppliedSubjectFilter] = useState("");
    const [appliedDaysLeftFilter, setAppliedDaysLeftFilter] = useState("");
    const [appliedOnTimetableFilter, setAppliedOnTimetableFilter] = useState("");


    //visible only 5 tasks at first
    const [visibleCount, setVisibleCount] = useState(5);

    //Group by dropdown (React Hook)
    const [groupByOption, setGroupByOption] = useState("none");

    //Add table link

    const TaskObjects_tableLinked = useMemo(() => {
        const object_base = reverseSort ? ReverseTasks : TaskObjects;
        return annotateAssignmentsWithEvents(object_base, events, SubjectMap);
    }, [reverseSort, ReverseTasks, TaskObjects, events, SubjectMap]);


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
    }, [TaskObjects_tableLinked, searchTerm, appliedPriorityFilter, appliedSubjectFilter,
        appliedDaysLeftFilter, appliedOnTimetableFilter]);


    //Create Separate Group each one has it own set of data
    const groupedTasks = useMemo(() => {
        if (groupByOption === "none") return { "": filteredTasks };

        const group = (taskValue) => Object.fromEntries(TaskGroupBy(filteredTasks, taskValue));

        switch (groupByOption) {

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
                        return days.map((i) => FULL_DAYS[i] || "Unassigned");
                    }
                    return FULL_DAYS[days] || "Unassigned";
                });


            default:
                return { "": filteredTasks };
        }
    }, [filteredTasks, groupByOption, SubjectMap]);

    return (
        <div className="pt-8 md:pt-12">

            {/*Utility buttons: Search bar + Filter + Group*/}
            <TaskFilterElements
                subjectOptions={subjectOptions}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                groupByOption={groupByOption}
                setGroupByOption={setGroupByOption}
                SubjectObjects={SubjectObjects}
                setAppliedPriorityFilter={setAppliedPriorityFilter}
                setAppliedSubjectFilter={setAppliedSubjectFilter}
                setAppliedDaysLeftFilter={setAppliedDaysLeftFilter}
                setAppliedOnTimetableFilter={setAppliedOnTimetableFilter}
                reverseSort={reverseSort}
                setReverseSort={setReverseSort}
            />


            {/* Colors legend : tell how far from deadline*/}
            <div className="flex flex-col md:flex-row items-center pt-[5px] gap-3 md:gap-5">
                {legends.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full ${item.color}`} />
                        <span className="text-sm font-medium">{item.label}</span>
                    </div>
                ))}
            </div>

            <div>
                <div>
                    {sortTasks(groupedTasks, groupByOption).map(([label, tasks]) => {
                        // Show only visibleCount items
                        const visibleTasks = tasks.slice(0, visibleCount);

                        return (
                            <div key={label}>
                                {/* Animated wrapper */}
                                <div className="space-y-3 transition-all duration-500">
                                    <AssignmentsGroup
                                        label={label}
                                        GroupedTasks={visibleTasks}
                                        SubjectMap={SubjectMap}
                                        onUpdateTask={onUpdateTask}
                                        onArchiveTask={onArchiveTask}
                                        events={events}
                                        pushToast={pushToast}
                                        reminderMap={reminderMap}
                                    />
                                </div>

                                {/* Buttons Section */}
                                <div className="w-full flex justify-center mt-4 mb-6 gap-3">

                                    {/* SHOW MORE */}
                                    {visibleCount < tasks.length && (
                                        <button
                                            onClick={() => setVisibleCount(prev => prev + 5)}
                                            className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700
                                       text-white text-sm font-semibold transition-all duration-300"
                                        >
                                            Show more ({tasks.length - visibleCount} left)
                                        </button>
                                    )}

                                    {/* SHOW LESS */}
                                    {visibleCount > 5 && (
                                        <button
                                            onClick={() => setVisibleCount(5)}
                                            className="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600
                                       text-white text-sm font-semibold transition-all duration-300"
                                        >
                                            Show less
                                        </button>
                                    )}

                                </div>
                            </div>
                        );
                    })}
                </div>

            </div>



        </div>
    );
}


// Sort Tasks before send to Group
function sortTasks(groupedTasks, groupBy) {
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


// --- Linking assignments to timetable events ---
function annotateAssignmentsWithEvents(items, events, SubjectMap) {
    return (items || []).map((a) => {
        const link = linkOneAssignmentToEvents(a, events, SubjectMap[a.subject].name);
        return { ...a, TableLink: link };
    });
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

// format the Course Name
function norm(s) {
    return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}


async function getReminder() {
    return get('/api/reminders/');
}
