import React, { useState } from "react";
import { AssignmentsCard } from "./assignmentsCard.jsx";
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import { colorGroupTask, defaultGrayColor } from "/src/utils/color.js";

// Break the Task to be different Group
export function TaskGroupBy(filteredTasks, getKey) {
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

// Group Tasks Element Logic
export function AssignmentsGroup({ label, GroupedTasks, SubjectMap, onUpdateTask, onArchiveTask, pushToast}) {
    const [isOpen, setIsOpen] = useState(true);

    function getColor(label) {
        if (colorGroupTask[label]) return colorGroupTask[label];

        const subjectEntry = Object.values(SubjectMap).find(
            (subject) => subject.name === label
        );
        if (subjectEntry?.color_hex) return subjectEntry.color_hex;
        return defaultGrayColor;
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
            <div className="flex items-center justify-start my-2">
                {label && (
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="px-3 text-sm hover:text-white transition"
                    >
                        {isOpen ? <ArrowDropDownIcon fontSize="large" /> : <ArrowRightIcon fontSize="large" />}
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
                            pushToast={pushToast}
                        />

                    ))}
                </div>
            )}
        </div>
    );
}
