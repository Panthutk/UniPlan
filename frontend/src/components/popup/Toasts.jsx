import React from "react";
import SaveIcon from "@mui/icons-material/Save";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

export function Toasts({ toasts, setToasts }) {
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
