import React, { useEffect, useState } from "react";
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { XIcon } from "/src/utils/icon.jsx";

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
        setSubjectFilter(Number(subject_value));
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
        setGroupByOption("none");
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
        <div className="flex flex-col md:flex-row items-center justify-start gap-4 pt-10 pb-2.5">

            {/*Search Bar*/}
            <div className="relative w-full md:w-[38%]">
                {/* Input text*/}
                <input
                    type="text"
                    placeholder="Search tasks by title..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-2 rounded-lg focus:outline-none  bg-[#38383a] text-sm focus:ring-[1.25px] focus:ring-gray-300 text-gray-400"
                />

                {/* Clear Button */}
                {searchTerm && (
                    <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-200 hover:text-gray-400 text-sm"
                    >
                        <XIcon />
                    </button>
                )}
            </div>


            {/*Filter Button*/}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen((prev) => !prev);
                }}
                className="relative px-4 py-1.5 bg-[#2e2e2e] text-gray-200 rounded-md hover:bg-[#252525] transition "
            >
                Filter
                <span className="ml-2"> <ArrowDropDownIcon/> </span>

                {/*Logic when the pop-up open*/}
                {isOpen && (
                    <div className=" my-1 flex flex-col absolute w-[300px] bg-[#2e2e2e] border border-gray-700 rounded-lg shadow-lg z-10 "
                         onClick={(e) => e.stopPropagation()}>

                        {/*filter by due date*/}
                        <div className="flex flex-col items-start ps-2 pb-5 pt-3 ">
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

                        {/*filter by subject*/}
                        <div className="flex flex-col items-start ps-2 pb-5">
                            Subject:
                            <select
                                value={subjectFilter}
                                onChange={(e) => handleSubjectChange(e.target.value)}
                                className="w-full max-w-xs truncate rounded-md border border-gray-500 bg-[#4c4949] px-3 py-2 text-sm shadow-sm focus:border-gray-300"
                            >
                                <option value="">Select subject</option>
                                {SubjectObjects.map((subject_value) => (
                                    <option key={subject_value.id} value={subject_value.id} >
                                        {subject_value.name}
                                    </option>
                                ))}
                            </select>

                        </div>

                        {/*filter by priority */}
                        <div className="flex flex-col items-start ps-2 pb-5">
                            Priority:
                            <div
                                className="flex flex-rol gap-3"
                            >
                                {["none", "low", "normal", "high"].map((priority_value) => (
                                    <label
                                        key={priority_value}
                                        className=" flex items-center gap-0.5 cursor-pointer "
                                    >
                                        <input
                                            type="checkbox"
                                            checked={priorityFilter === priority_value}
                                            onChange={() => handlePriorityChange(priority_value)}
                                        />
                                        <span className="capitalize">{PriorityShow[priority_value]}</span>
                                    </label>
                                ))}
                            </div>
                        </div>


                        <div className="flex flex-col items-start ps-2 pb-5">
                            Task's Lecture on Timetable:
                            {tableLinked.map((timetable_value) => (
                                <label
                                    key={timetable_value.value}
                                    className="items-center gap-2 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={onTimetableFilter === timetable_value.value}
                                        onChange={() => handleOnTimeableChange(timetable_value.value)}
                                        className="rounded "
                                    />
                                    <span className="capitalize">{timetable_value.label}</span>
                                </label>
                            ))}
                        </div>

                        <button
                            className="m-3 px-3 py-1.5 bg-green-700 text-white rounded-lg hover:bg-green-600 transition"
                            onClick={() => {
                                setAppliedPriorityFilter(priorityFilter);
                                setAppliedSubjectFilter(subjectFilter);
                                setAppliedSourceFilter(sourceFilter);
                                setAppliedDaysLeftFilter(daysLeftFilter);
                                setAppliedOnTimetableFilter(onTimetableFilter);
                                toggleDropdown();
                            }}
                        >
                            Apply Filter
                        </button>

                    </div>
                )}
            </button>


            {/*GroupBy Drop-box*/}
            <div className="relative inline-block">
                <select
                    value={groupByOption}
                    onChange={(e) => setGroupByOption(e.target.value)}
                    className="text-gray-200 p-2 pr-8 rounded-md bg-[#2e2e2e] hover:bg-[#252525] shadow appearance-none"
                >
                    <option value="none" disabled hidden>
                        Group By
                    </option>
                    <option value="subject">By Subject</option>
                    <option value="priority">By Priority</option>
                    <option value="lecture day">By Lecture Day</option>
                </select>

                {/* Custom arrow icon */}
                <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ArrowDropDownIcon/>
                </span>
            </div>


            {/*Clear filter Button*/}
            <button
                onClick={ClearFilters}
                className="text-[#777777] underline pt-3 text-sm "
            >
                Clear all
            </button>


        </div>
    )
}