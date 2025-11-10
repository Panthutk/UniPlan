// frontend/src/utils/time.js

/* ----------------- Time / Day helpers ----------------- */

export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export const TIMES = Array.from({ length: 12 }, (_, i) => 8 + i); // 08..19

export const colFromTime = (h) => (h - 8) + 2;   // 8 -> col 2, 19 -> 13
export const rowFromDay = (d) => d + 2;          // 0..6 -> rows 2..8

export const toHHMM = (m) => {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    return `${hh}:${mm}`;
};

// "HH:MM:SS" format for Django (e.g., 08:15:00)
export const toLabelSS = (m) => `${toHHMM(m)}:00`;

// Hour-based grid snapping
export const startHour = (m) => Math.floor(m / 60); // e.g., 08:15 -> 8
export const endHour = (mStart, mEnd) =>
    Math.max(Math.ceil(mEnd / 60), Math.floor(mStart / 60) + 1); // at least 1h wide

export const parseHHMM = (s) => {
    if (!s) return 0;
    const [H, M] = String(s).split(":").map(Number);
    return (H || 0) * 60 + (M || 0);
};

export const startOffsetPx = (mStart) => ((mStart % 60) / 60) * 120;
export const endTrimPx = (mEnd) =>
    (mEnd % 60 === 0 ? 0 : (1 - (mEnd % 60) / 60) * 120);