import React, { useState } from "react";
import uniplanLogo from "./assets/uniplanLogo.svg";
import {Link, NavLink, useLocation} from "react-router-dom";
import Pic1 from "./assets/pic1.png";
import Pic2 from "./assets/pic2.png";
import Pic3 from "./assets/pic3.jpg";
import Pic4 from "./assets/pic4.png";
import company_logo from "./assets/TawanRapfa_logo2.svg";


export default function About() {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(0);
    const tabs = ["Member no.1", "Member no.2", "Member no.3", "Member no.4"];
    const members_info = [
        { src: Pic1, first_name: "Pannawit", last_name:"Mahacharoensiri" ,email: "pannawit.m@ku.th", github_name: "PannawitMahacharoensiri", github:"https://github.com/PannawitMahacharoensiri" },
        { src: Pic2, first_name: "Jongchana", last_name:"Khachatrokphai" ,email: "jongchana.kh@ku.th", github_name: "StewedDuck", github:"https://github.com/StewedDuck" },
        { src: Pic3, first_name: "Panthut", last_name:"Ketphan" , email: "panthut.k@ku.th", github_name: "Panthutk", github:"https://github.com/Panthutk" },
        { src: Pic4, first_name: "Sorasit", last_name:"Kateratorn" ,email: "sorasit.ka@ku.th", github_name: "Sorasit-Kateratorn", github:"https://github.com/Sorasit-Kateratorn" },
    ];

    return (

        <div className="min-h-screen w-auto overflow-x-hidden overflow-y-hidden bg-[#171717]">

            {/* NAVBAR */}
            <header className="sticky top-0 z-50 bg-neutral-900/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/60">
                <div className="w-full pl-5 sm:pl-6 lg:pl-8 pr-5 sm:pr-6 lg:pr-8 flex items-center justify-between">
                    <div className="flex flex-col items-start justify-center align-middle gap-2 h-16">
                        <img
                            src={uniplanLogo}
                            alt="Uniplan Logo"
                            className="h-[clamp(20px,6vh,50px)] w-auto"
                        />
                    </div>

                    <nav className="flex items-center gap-3 justify-end">
                        <NavLink
                            to={location.state?.from === "/tableandtask" ? "/tableandtask" : "/"}
                            className= {
                                ({ isActive }) => `rounded-md border border-white/15 px-3 py-1.5 text-[clamp(12px,2vh,20px)] ${isActive ? "bg-white/10 text-white" : "text-zinc-200 hover:bg-white/5"}`
                            }
                        >
                            {location.state?.from === "/tableandtask" ? "Home" : "login" }
                        </NavLink>
                    </nav>
                </div>
            </header>

            {/* first section welcome message */}
            <div className="w-full">
                <div className="max-w-[1400px] mx-auto w-full px-8 flex flex-col md:flex-row items-center justify-between">
                    {/* Left side text */}
                    <div className="flex-1 pr-10 md:pr-20">
                        <div className="h-full">
                            <span className="text-white leading-snug text-[45px] xl:text-[50px] text-right flex justify-end py-8 md:py-12">
                                Let’s Get to Know <br/> Our Developer at
                            </span>
                            <span className="font-lexend text-right flex text-[#69a064] font-medium text-[35px] xl:text-[55px] justify-end py-4 md:py-8">
                                TarwanRapfa Co.
                            </span>
                            <span className="flex justify-end text-right text-[#aeb0af] text-[16px] xl:text-[22px] pt-10 pb-20">
                                *This cooperation only refers to the group name<br/>It is not real and does not actually exist
                            </span>
                        </div>
                    </div>

                    {/* Right side image */}
                    <div className="relative flex items-center justify-center basis-[500px] h-[400px] md:h-[600px] overflow-hidden">

                        {/* Background Columns */}
                        <div className="absolute inset-0 flex justify-between">
                            <div className="w-[100px] md:w-[120px] bg-[#5d936d]" />
                            <div className="w-[100px] md:w-[120px] bg-[#518a61]" />
                            <div className="w-[100px] md:w-[120px] bg-[#41754f]" />
                            <div className="w-[100px] md:w-[120px] bg-[#3b704a]" />
                        </div>

                        {/* Slide bars */}
                        <div className="absolute inset-0 z-10 flex justify-between">
                            <div className="relative w-[100px] md:w-[120px] h-full">
                                <div className="absolute top-0 left-0 w-full h-[3%] bg-[#171717] animate-slideDown" />
                            </div>
                            <div className="relative w-[100px] md:w-[120px] h-full">
                                <div className="absolute top-0 left-0 w-full h-[3%] bg-[#171717] animate-slideDown" style={{ animationDelay: "8s" }} />
                            </div>
                            <div className="relative w-[100px] md:w-[120px] h-full">
                                <div className="absolute top-0 left-0 w-full h-[3%] bg-[#171717] animate-slideDown" style={{ animationDelay: "2s" }} />
                            </div>
                            <div className="relative w-[100px] md:w-[120px] h-full">
                                <div className="absolute top-0 left-0 w-full h-[3%] bg-[#171717] animate-slideDown" style={{ animationDelay: "3.5s" }} />
                            </div>
                        </div>

                        {/* Logo */}
                        <img
                            src={company_logo}
                            alt="TawanRapfa"
                            className="animate-zoomIn z-20 w-4/5 h-auto"
                        />
                    </div>
                </div>
            </div>


            {/* Spacer */}
            <div className="bg-transparent h-[170px] md:h-[100px] w-auto" />

            {/* Second section */}
            <div className="max-w-[1800px] mx-auto w-full px-8 flex flex-col md:flex-row gap-6">

                {/* left tabs */}
                <div className="rounded-2xl  md:max-w-[300px] w-auto md:w-full bg-[#212121] flex flex-col px-4 py-6 gap-3 md:sticky md:top-[80px]">

                    <span className="text-center text-[#aeb0af] mb-2 text-[24px]">
                        OUR DEVELOPERS
                    </span>

                        {tabs.map((tab, index) => (
                            <button
                                key={index}
                                onClick={() => setActiveTab(index)}
                                className={`p-3 text-[22px] text-center rounded-2xl transition ${
                                    activeTab === index ? "bg-[#395d44] text-white" : "text-[#aeaeae] hover:bg-[#5e5757]"
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                </div>

                    {/* right content */}
                <div className="flex flex-col flex-1">

                    {/* Name box */}
                    <div className="rounded-sm px-6 py-6 bg-[#518b61] flex justify-between items-start mb-6">

                        <div className="text-[25px] xl:text-[60px] font-bold leading-tight">
                            <p className="animate-slideInLeft mb-2">
                                {members_info[activeTab].first_name}
                            </p>
                            <p className="animate-slideIn_Leftdelay">
                                {members_info[activeTab].last_name}
                            </p>
                        </div>

                        <img
                            src={members_info[activeTab].src}
                            alt="profile"
                            className="rounded-sm w-[160px] h-auto animate-zoomIn"
                        />
                    </div>

                    {/* Info rows */}
                    <div className="rounded-lg bg-[#6b9f7b] mb-4 py-4 px-6 text-10 md:text-[25px] flex gap-2">
                        <span className="text-gray-300 tracking-widest">Email:</span>
                        <span className="text-white animate-slideInLeft">{members_info[activeTab].email}</span>
                    </div>

                    <div className="rounded-lg bg-[#6b9f7b] mb-4 py-4 px-6 text-10 md:text-[25px] flex gap-2">
                        <span className="text-gray-300 tracking-widest">GitHub:</span>
                        <a href={members_info[activeTab].github} className="text-[#364e3d] hover:underline animate-slideInLeft">
                            {members_info[activeTab].github_name}
                        </a>
                    </div>

                    <div className="rounded-lg bg-[#6b9f7b] mb-4 py-4 px-6 text-10 md:text-[25px] flex gap-2">
                        <span className="text-gray-300 tracking-widest">University:</span>
                        <a href="https://www.ku.ac.th/en/community-home" className="text-[#364e3d] hover:underline">
                            Kasetsart University - Bangkhen campus
                        </a>
                    </div>

                    <div className="rounded-lg bg-[#6b9f7b] mb-4 py-4 px-6 text-10 md:text-[25px] flex gap-2">
                        <span className="text-gray-300 tracking-widest">Faculty:</span>
                        <a href="https://cpe.ku.ac.th/index.php/ske/" className="text-[#364e3d] hover:underline">
                            Software and Knowledge Engineering
                        </a>
                    </div>

                </div>
            </div>


            {/* Third section */}
            <div className="max-w-[1200px] mx-auto w-full px-8 py-20 flex flex-col md:flex-row items-center justify-between gap-10">

                {/* Text */}
                <div className="tracking-widest text-center md:text-left font-back text-white text-[28px]">
                    <p>
                        Are you ready to
                        <span> {location.state?.from === "/tableandtask" ? " continue " : " start "} </span>
                        your
                        <span className="ml-2 bg-gradient-to-r from-[#6b9e7b] to-yellow-400 bg-clip-text text-transparent">
                Planning?
            </span>
                    </p>
                </div>

                {/* Button */}
                <div className="flex justify-center md:justify-end w-full md:w-auto">
                    <NavLink
                        to={location.state?.from === "/tableandtask" ? "/tableandtask" : "/"}
                        className={({ isActive }) =>
                            `rounded-md border border-white/15 bg-[#3a5e45] py-3 px-10 text-[16px] ${
                                isActive
                                    ? "text-white"
                                    : "text-zinc-200 hover:bg-[#2bb75a] hover:text-white hover:scale-110 transition-transform duration-300"
                            }`
                        }
                    >
                        Return
                    </NavLink>
                </div>
            </div>


            {/* Footer */}
            <footer className="border-t border-white/10">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 text-sm text-zinc-400">
                    © {new Date().getFullYear()} UniPlan · All rights reserved
                </div>
            </footer>

        </div>
    );
}
