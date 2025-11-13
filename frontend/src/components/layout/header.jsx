import { useNavigate, Link } from "react-router-dom";
import React from "react";
import uniplanLogo from '../../assets/uniplanLogo.svg';

export function HeaderSection() {
    const navigate = useNavigate();

    return (
        <header className="sticky top-0 z-50 bg-neutral-900/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/60">
            <div className="w-full pl-5 sm:pl-6 lg:pl-8 pr-5 sm:pr-6 lg:pr-8 flex items-center justify-between">
                <div className="flex flex-col items-start justify-center align-middle gap-2 h-16">
                    <img
                        src={uniplanLogo}
                        alt="Uniplan Logo"
                        className="h-[clamp(20px,6vh,50px)] w-auto"
                    />
                </div>

                <div className="flex items-center gap-6">
                    <Link
                        to="/about"
                        state={{ from: "/tableandtask" }}
                        className="opacity-90 text-sm hover:underline"
                    >
                        Contact
                    </Link>
                    <button
                        className="border rounded-lg px-3 py-2"
                        onClick={() => {
                            localStorage.clear();
                            navigate("/", { replace: true });
                        }}
                    >
                        Logout
                    </button>
                </div>


            </div>
        </header>
    );
}
