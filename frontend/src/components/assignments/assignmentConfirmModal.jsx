import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function ConfirmModal({
    open,
    title = "Confirm",
    message = "Are you sure?",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    loading = false,
    error = "",
    onConfirm,
    onCancel,
}) {
    const confirmBtnRef = useRef(null);

    useEffect(() => {
        if (open) {
            // focus the primary action when opened
            confirmBtnRef.current?.focus();
        }
    }, [open]);

    if (!open) return null;
    const handleBackdrop = (e) => {
        if (e.target === e.currentTarget && !loading) onCancel?.();
    };

    const onKeyDown = (e) => {
        if (e.key === "Escape" && !loading) onCancel?.();
    };


    const modalBody = (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
            onKeyDown={onKeyDown}
        >
            {/* Backdrop overlay*/}
            <div
                className="absolute inset-0 bg-black/60"
                onClick={handleBackdrop}
            />

            {/* Dialog window*/}
            <div
                className="relative z-10 w-[min(520px,92vw)] rounded-2xl bg-neutral-900 text-white p-5 shadow-xl"
            >

                <div className="text-lg font-semibold mb-1" id="confirm-title">
                    {title}
                </div>
                <div className="text-sm opacity-80 mb-3" id="confirm-desc">
                    {message}
                </div>

                {error ? (
                    <div className="mb-3 text-sm text-rose-400" role="alert" aria-live="assertive">
                        {error}
                    </div>
                ) : null}

                <div className="mt-4 flex items-center justify-end gap-3">
                    {cancelLabel ? (
                        <button
                            onClick={onCancel}
                            disabled={loading}
                            className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 font-semibold disabled:opacity-60"
                        >
                            {cancelLabel}
                        </button>
                    ) : null}

                    <button
                        ref={confirmBtnRef}
                        onClick={onConfirm}
                        disabled={loading}
                        className="px-6 py-2 rounded-full font-semibold border border-emerald-500
                                    bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-2
                                    focus-visible:ring-emerald-400/60 disabled:opacity-60"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalBody, document.body);
}
