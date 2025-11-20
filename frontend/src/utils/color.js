export const defaultGrayColor = "#808080";

// 0=Mon ... 6=Sun
export function colorForDay(day) {
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

// Use specific for Assignments Group function
export const colorGroupTask = {
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
    "": defaultGrayColor // default
};

export function getTasks_Ring_BG_Color(days_left) {
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

    return [dayBg, dayRing];
}

export function CreateNewColorHex() {
    const randomColor = Math.floor(Math.random() * 16777215).toString(16);
    return `#${randomColor.padStart(6, "0")}`;
}
