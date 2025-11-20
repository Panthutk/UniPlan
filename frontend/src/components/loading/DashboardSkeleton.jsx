export default function DashboardSkeleton() {
    return (
        <div className="min-h-screen bg-neutral-900 text-white animate-pulse select-none"
            style={{ fontFamily: "Manrope, sans-serif" }}>

            {/* Header Bar */}
            <div className="w-full flex items-center justify-between px-6 py-4 border-b border-neutral-800">
                {/* Logo */}
                <div className="h-8 w-32 bg-neutral-800 rounded"></div>

                {/* Menu Right */}
                <div className="flex items-center gap-4">
                    <div className="h-6 w-20 bg-neutral-800 rounded"></div>
                    <div className="h-8 w-20 bg-neutral-800 rounded"></div>
                </div>
            </div>

            {/* Sidebar button + top menu */}
            <div className="px-6 mt-6 flex items-center justify-between">
                {/* Sidebar toggle */}
                <div className="h-10 w-10 bg-neutral-800 rounded"></div>

                {/* Top right buttons */}
                <div className="flex items-center gap-3">
                    <div className="h-8 w-20 bg-neutral-800 rounded-full"></div>
                    <div className="h-8 w-20 bg-neutral-800 rounded-full"></div>
                    <div className="h-8 w-20 bg-neutral-800 rounded-full"></div>
                    <div className="h-8 w-28 bg-neutral-800 rounded-full"></div>
                </div>
            </div>

            {/* MAIN TIMETABLE CONTAINER */}
            <div className="px-6 mt-10">
                <div className="bg-neutral-800/30 border border-neutral-700/50 rounded-xl p-4 mx-auto max-w-[1400px]">

                    {/* Header row */}
                    <div className="grid grid-cols-8 gap-3 mb-4">
                        <div className="h-6 bg-neutral-800 rounded"></div>
                        {Array.from({ length: 7 }).map((_, i) => (
                            <div key={i} className="h-6 bg-neutral-800 rounded"></div>
                        ))}
                    </div>

                    {/* Timetable grid */}
                    <div className="grid grid-cols-8 gap-3">
                        {/* Day labels */}
                        <div className="space-y-8 mt-2">
                            {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d, i) => (
                                <div key={i} className="h-6 w-14 bg-neutral-800 rounded"></div>
                            ))}
                        </div>

                        {/* Time blocks */}
                        <div className="col-span-7 space-y-6">
                            {Array.from({ length: 7 }).map((_, rowIdx) => (
                                <div key={rowIdx} className="grid grid-cols-12 gap-2">
                                    {Array.from({ length: 12 }).map((_, colIdx) => (
                                        <div
                                            key={colIdx}
                                            className="h-14 bg-neutral-800/40 border border-neutral-700/40 rounded"
                                        ></div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* TASKS AREA SKELETON */}
            <div className="mt-16 w-full flex justify-center">
                <div className="text-neutral-600 text-sm">Loading tasks...</div>
            </div>

            {/* Extra spacing */}
            <div className="h-40"></div>
        </div>
    );
}
