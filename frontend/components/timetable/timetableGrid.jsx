import { memo } from "react";
import { TIMES, DAYS, rowFromDay, colFromTime, startHour, endHour, toHHMM, startOffsetPx, endTrimPx } from "/src/utils/time.js";

/* ----------------- UI: Timetable (clickable & shows events) ------------------- */
export const TimetableGrid = memo(function TimetableGrid({ events, onCellClick, onEventClick }) {
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
                            className="relative" // anchor for absolute child
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
