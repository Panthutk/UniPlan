import React, { useEffect, useState } from "react";

export function TaskFilterElements({ searchTerm, setSearchTerm, groupByOption, setGroupByOption, SubjectObjects,
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