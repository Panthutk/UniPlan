import SaveIcon from "@mui/icons-material/Save";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { API, authHeader } from "/src/utils/api.js";
import { XIcon } from "/src/utils/icon.jsx";
import { TimetableGrid } from '../timetable/timetableGrid';
import { AssignmentsBoard } from '../assignments/assignmentsBoard.jsx';
import React from "react";

export function DrawerPanel({menuOpen, setMenuOpen, user, timetableRef, activeMenu, tasksRef, handleShowArchived,
                         handleClearEvents, events, handleCellClick, handleEventClick, tasksLoading, taskObjects, handleUpdateTask
                         , archiveTask, subjects, toasts, setToasts, onImport, onExport, importBusy = false, exportBusy = false,}) {

    return (
        <div>

            {/*Hamburger Button*/}
            <div className="sticky z-50 pl-2 pointer-events-none"
                 style={{ top: "calc(var(--header-h, 72px))" }} // this is offset from the top equal to header height (default 72px) prevent overlap with header
            >
                <div className=" pl-5 sm:pl-6 lg:pl-8 pr-5 sm:pr-6 lg:pr-8 py-2 ">
                    <button
                        onClick={() => setMenuOpen(true)}
                        className="inline-flex items-center gap-2 border rounded-lg px-3 py-2 text-sm pointer-events-auto"
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
                <div className="pb-10 grid grid-cols-1 gap-y-12 items-start min-w-0">

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
                                <XIcon />
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

                            {/* Archived Tasks button */}
                            <button
                                onClick={() => {
                                    handleShowArchived();
                                    setMenuOpen(false);
                                }}
                                className="w-full py-4 rounded-full font-semibold bg-neutral-700 hover:bg-neutral-600"
                            >
                                Archived Tasks
                            </button>

                        </nav>

                    </aside>




                    {/* RIGHT — timetable + tasks */}
                    <main className="space-y-6 min-w-0 z-60">
                        {/* actions */}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={handleClearEvents}
                                className="px-5 py-2 rounded-full bg-rose-500 hover:bg-rose-600 font-semibold"
                                title="Clear"
                            >
                                Clear
                            </button>
                            <button
                              onClick={onImport}
                              disabled={importBusy}
                              className={[
                                "px-5 py-2 rounded-full font-semibold",
                                importBusy ? "bg-neutral-700 cursor-not-allowed" : "bg-emerald-700 hover:bg-emerald-800",
                              ].join(" ")}
                            >
                              {importBusy ? "Importing…" : "Import"}
                            </button>
                          
                            <button
                              onClick={onExport}
                              disabled={exportBusy}
                              className={[
                                "px-5 py-2 rounded-full font-semibold",
                                exportBusy ? "bg-neutral-700 cursor-not-allowed" : "bg-emerald-700 hover:bg-emerald-800",
                              ].join(" ")}
                            >
                              {exportBusy ? "Exporting…" : "Export"}
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
                            {tasksLoading ? (
                                <div className="flex items-center justify-center h-[40vh] text-gray-400">
                                    Refreshing tasks...
                                </div>
                            ) : !taskObjects || taskObjects.length === 0 ? (
                                <div className="flex items-center justify-center h-[40vh] text-gray-400">
                                    No tasks available.
                                </div>
                            ) : (
                                <AssignmentsBoard
                                    TaskObjects={taskObjects}
                                    onUpdateTask={handleUpdateTask}
                                    onArchiveTask={archiveTask}
                                    SubjectObjects={subjects}
                                    events={events}
                                />
                            )}
                        </div>

                        <Toasts
                            toasts={toasts}
                            setToasts={setToasts}
                        />

                    </main>
                </div>
            </div>
        </div>


    );
}

function Toasts({toasts, setToasts}) {
    const typeStyle = (tp) =>
        tp === "success"
            ? "border-emerald-500/40 bg-emerald-500/10"
            : tp === "error"
                ? "border-rose-500/40 bg-rose-500/10"
                : "border-sky-500/40 bg-sky-500/10"

    const defaultIcon = (tp) =>
        tp === "success" ? <SaveIcon sx={{ fontSize: 20 }} /> :
            tp === "error" ? <ErrorOutlineIcon sx={{ fontSize: 20 }} /> :
                <InfoOutlinedIcon sx={{ fontSize: 20 }} />; //icon size

    return (
        <div
            className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw, 380px)] flex-col gap-3"
            aria-live="polite"
        >
            {toasts.map((t) => (
                <div
                    key={t.id}
                    role="status"
                    className={`pointer-events-auto rounded-xl border p-4 shadow-xl backdrop-blur text-white/90 ${typeStyle(
                        t.type
                    )}`}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                            {/* ICON */}
                            <div className="mt-0.5 shrink-0 opacity-90">
                                {t.icon ?? defaultIcon(t.type)}
                            </div>
                            {/* TEXT */}
                            <div className="min-w-0">
                                <div className="font-semibold leading-tight">{t.title}</div>
                                {t.desc ? (
                                    <div className="mt-1 text-sm opacity-80 break-words">{t.desc}</div>
                                ) : null}
                            </div>
                        </div>
                        <button
                            onClick={() =>
                                setToasts((toasts) => toasts.filter((x) => x.id !== t.id))
                            }
                            className="ml-2 rounded-md px-2 py-1 text-sm opacity-70 hover:opacity-100"
                            aria-label="Close"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
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