import React, { useEffect, useState } from "react";
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import { XIcon } from "/src/utils/icon.jsx";

export function TaskFilterElements({ searchTerm, setSearchTerm, groupByOption, setGroupByOption, SubjectObjects,
                                setAppliedPriorityFilter, setAppliedSubjectFilter,
                                setAppliedDaysLeftFilter, setAppliedOnTimetableFilter }) {

    // Filter Hooks
    const [priorityFilter, setPriorityFilter] = useState("");
    const [subjectFilter, setSubjectFilter] = useState("");
    const [daysLeftFilter, setDaysLeftFilter] = useState("");
    const [onTimetableFilter, setOnTimetableFilter] = useState("");
    const [filterNum, setFilterNum] = useState(0);

    // Filter Button open/close logic
    const [isOpen, setIsOpen] = useState(false);
    const toggleFilter = () => {
        setIsOpen(prev => {
            if (!prev) setIsOpenGroup(false); // if opening main, close group
            return !prev;
        });
    };
    // Group By Button open/close logic
    const [isOpenGroup, setIsOpenGroup] = useState(false);
    const toggleGroup = () => {
        setIsOpenGroup(prev => {
            if (!prev) setIsOpen(false); // if opening group, close main
            return !prev;
        });
    };

    // Filter function logic
    const handlePriorityChange = (priority_value) => {
        setPriorityFilter(prev => prev === priority_value ? "" : priority_value);
    };
    const handleSubjectChange = (subject_value) => {
        setSubjectFilter(Number(subject_value));
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
        setDaysLeftFilter("");
        setOnTimetableFilter("");
        setAppliedPriorityFilter("");
        setAppliedSubjectFilter("");
        setAppliedDaysLeftFilter("");
        setAppliedOnTimetableFilter("");
        setFilterNum(0);
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

    const ringStyleFilter = filterNum !== 0 ? { boxShadow: `0 0 0 1.25px  #759072` } : {};
    const ringStyleGroupBy = groupByOption !== "none" ? { boxShadow: `0 0 0 1.25px #759072` } : {};

    useEffect(() => {
        const handleClickOutside = () => setIsOpen(false);
        if (isOpen) document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = () => setIsOpenGroup(false);
        if (isOpenGroup) document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [isOpenGroup]);

    return (
        <div className="flex flex-col md:flex-row items-center justify-start gap-2 pt-10 pb-2.5">

            {/*Search Bar*/}
            <div className="relative w-full md:w-[38%] mr-[3px]">
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
            <div className="relative inline-block ">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleFilter();
                    }}
                    className="flex flex-row relative pl-3 pr-1 py-1.5 bg-[#2e2e2e] text-gray-200 rounded-md hover:bg-[#252525] transition focus:ring-[1.25px] focus:ring-gray-300 "
                    style={ringStyleFilter}
                >
                    {filterNum ? formatFilters(filterNum) : "Filter"}
                    <span> {isOpen ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />} </span>
                </button>

                {/*Logic when the pop-up open*/}
                {isOpen && (
                    <div className=" mt-1.5 flex flex-col absolute left-1/2 -translate-x-1/2 w-[300px] bg-[#2e2e2e] border border-gray-700 rounded-lg shadow-lg z-10 "
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
                                className="w-[280px] max-w-xs truncate rounded-md border border-gray-500 bg-[#4c4949] px-3 py-2 text-sm shadow-sm focus:border-gray-300"
                            >
                                <option value="" disabled hidden>Select subject</option>
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

                        {/*filter by Lecture*/}
                        <div className="flex flex-col items-start ps-2 pb-5">
                            Task's Lecture on Timetable:
                            <div className="flex flex-row items-center gap-3">
                                {tableLinked.map((timetable_value) => (
                                    <label
                                        key={timetable_value.value}
                                        className="flex items-center gap-1 cursor-pointer "
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
                        </div>

                        {/*Apply filter button*/}
                        <button
                            className="m-3 px-3 py-1.5 bg-green-700 text-white rounded-lg hover:bg-green-600 transition"
                            onClick={() => {
                                setFilterNum(0);
                                setAppliedPriorityFilter(priorityFilter);
                                setAppliedSubjectFilter(subjectFilter);
                                setAppliedDaysLeftFilter(daysLeftFilter);
                                setAppliedOnTimetableFilter(onTimetableFilter);
                                priorityFilter !== "" && setFilterNum((prev) => prev + 1);
                                subjectFilter !== "" && setFilterNum((prev) => prev + 1);
                                daysLeftFilter !== "" && setFilterNum((prev) => prev + 1);
                                onTimetableFilter !== "" && setFilterNum((prev) => prev + 1);
                                toggleFilter();
                            }}
                        >
                            Apply Filter
                        </button>

                    </div>
                    )}

            </div>


            {/*GroupBy drop-box Button*/}
            <div className="relative inline-block">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleGroup();
                    }}
                    className="flex flex-row relative pl-3 pr-1 py-1.5 bg-[#2e2e2e] text-gray-200 text-md rounded-md hover:bg-[#252525] transition focus:ring-[1.25px] focus:ring-gray-300 "
                    style={ringStyleGroupBy}
                >
                    {groupByOption!=="none" ? formatGroupBy(groupByOption) : "Group by"}
                    <span> {isOpenGroup ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />} </span>
                </button>

                {isOpenGroup && (
                    <div className=" mt-1.5 flex flex-col py-1.5 gap-1 absolute left-1/2 -translate-x-1/2 w-[130px] bg-[#2e2e2e] border border-gray-700 rounded-lg shadow-lg z-10 "
                         onClick={(e) => e.stopPropagation()}>

                        <button onClick={() => { setGroupByOption("subject"); toggleGroup(); }}
                                className="flex items-start  pl-2 text-md hover:bg-[#1967d2]">
                            Subject
                        </button>
                        <button onClick={() => { setGroupByOption("priority"); toggleGroup(); }}
                                className="flex items-start  pl-2 text-md w-full hover:bg-[#1967d2]">
                            Priority
                        </button>
                        <button onClick={() => { setGroupByOption("lecture day"); toggleGroup(); }}
                                className="flex items-start  pl-2 text-md w-full hover:bg-[#1967d2]">
                            Lecture Day
                        </button>

                    </div>


                )}


            </div>

            {/*Clear filter Button*/}
            {(filterNum !== 0 || searchTerm !== "" || groupByOption !== "none") && (
                <button
                    onClick={ClearFilters}
                    className="text-[#b7b7b7] hover:text-[#dedada] underline pt-3 text-sm"
                >
                    Clear all
                </button>
            )}


        </div>
    )
}


function formatFilters(choice) {
    return(
        <div className="flex items-center gap-2 text-md">
            <span>Filter</span>

            <div className="w-[1px] h-5 bg-[#759072]"></div>

            <span className="text-[#69a064] text-[15px]">{choice} applied</span>
        </div>
    );
}

function formatGroupBy(choice) {
    return(
        <div className="flex items-center gap-2 text-md">
            <span>Group by</span>

            <div className="w-[1px] h-5 bg-[#759072]"></div>

            <span className="text-[#69a064] text-[15px] capitalize">{choice}</span>
        </div>
    );
}