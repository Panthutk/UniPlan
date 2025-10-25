import React, { useState } from "react";
import uniplanLogo from "./assets/uniplanLogo.svg";
import { NavLink, useLocation} from "react-router-dom";
import Pic1 from "./assets/pic1.png";
import Pic2 from "./assets/pic2.png";
import Pic3 from "./assets/pic3.jpg";
import Pic4 from "./assets/pic4.png";
import company_logo from "./assets/TawanRapfa_logo2.svg";


export default function About() {
    const location = useLocation();
    console.log(location.state);
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
            <header className="sticky top-0 flex items-center z-50 h-[clamp(34px,8.5vh,58px)] py-3 bg-neutral-900/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/60">
                <div className="container flex mx-auto max-w-[1600px] px-5 sm:px-6 lg:px-8 items-center justify-between">
                    <img
                        src={uniplanLogo}
                        alt="Uniplan Logo"
                        className="h-[clamp(30px,6vh,50px)] w-auto"
                    />
                    <nav className="flex items-center gap-3">
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
            <div className="w-auto h-auto ">
                {/* left side - first section  */}
                <div className="mx-10 md:mx-auto w-auto md:w-[93vw] flex flex-col md:flex-row">
                    <div className="shrink-0 basis-3/5 mb-[12vh] md:mb-[20vh] ">
                        <div className="h-full mr-[10%]">
              <span className="font-lexend text-white leading-snug text-[clamp(25px,4.5vw,45px)] xl:text-[clamp(20px,6.5vh,70px)] text-right flex justify-end py-[7%]">
                Let’s Get to<br/> Know Our<br/> Developer at
              </span>
                            <span className="font-lexend text-right flex text-[#69a064] font-medium text-[clamp(25px,4.5vw,45px)] xl:text-[clamp(25px,7.5vh,90px)] justify-end py-[2%]">
                TarwanRapfa Co.
              </span>
                            <span className="font-cousine flex justify-end text-right text-[#aeb0af] text-[clamp(12px,1.75vw,18px)] xl:text-[clamp(15px,3vh,20px)]">
                *This cooperation only refers to the group name<br/>It is not real and does not actually exist
              </span>
                        </div>
                    </div>

                    {/* right side - first section  */}
                    <div className="relative shrink-0 basis-2/5 flex items-center justify-center overflow-hidden">
                        {/* 4 vertical lines (behind the logo) */}
                        <div className="absolute inset-0 flex items-start justify-between">
                            <div className="w-[23%] rounded-sm h-full bg-[#5d936d] " />
                            <div className="w-[23%] rounded-sm h-full bg-[#518a61] "/>
                            <div className="w-[23%] rounded-sm h-full bg-[#41754f] " />
                            <div className="w-[23%] rounded-sm h-full bg-[#3b704a]" />

                        </div>
                        <div className="absolute inset-0 z-10 flex items-start justify-between">
                            <div className="relative w-[23%] h-full">
                                <div className="absolute top-0 left-0 w-full h-[3%] bg-[#171717] animate-slideDown" />
                            </div>
                            <div className="relative w-[23%] h-full">
                                <div className="absolute top-0 left-0 w-full h-[2.6%] bg-[#171717] animate-slideDown" style={{ animationDelay: "8s" }} />
                            </div>
                            <div className="relative w-[23%] h-full">
                                <div className="absolute top-0 left-0 w-full h-[2.3%] bg-[#171717] animate-slideDown" style={{ animationDelay: "2s" }}/>
                            </div>
                            <div className="relative w-[23%] h-full">
                                <div className="absolute top-0 left-0 w-full h-[3%] bg-[#171717] animate-slideDown" style={{ animationDelay: "3.5s" }}/>
                            </div>
                        </div>

                        {/* Logo on top */}
                        <img
                            src={company_logo}
                            alt="TawanRapfa"
                            className="animate-zoomIn relative z-10 w-[clamp(50px,50vw,480px)] h-auto"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-transparent h-[12vh] md:h-[15vh] w-auto"/>


            {/* second section : real info */}
            <div className="flex w-auto ml-10 md:ml-16 mr-[5%] md:mr-[1.65%] flex-col md:flex-row">
                {/* Left side of second section - Tabs */}
                <div className=" rounded-2xl max-w-[700px] w-auto md:w-[30%] bg-[#212121] h-[50%] flex flex-col px-[8%] md:sticky md:top-[8%] md:px-[2%] py-[8%] md:py-[2%] my-[3%] gap-3 md:my-0">
            <span className="text-center font-lexend text-[#aeb0af] mb-[1vh] text-[clamp(19px,1.7vw,27px)]">
              OUR DEVELOPERS
            </span>
                    {tabs.map((tab, index) => (
                        <button key={index} onClick={() => setActiveTab(index)} className={`p-3  text-[clamp(19px,4vh,40px)] text-center font-cousine transition text-[#aeaeae] rounded-2xl
                  ${activeTab === index ? "bg-[#395d44] text-[#ffffff]" : "hover:bg-[#5e5757] scale-75"}`}>
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Right side of second section - Content */}
                <div key={activeTab} className="flex flex-col flex-1 md:ml-[1.75%]">
                    <div className="h-auto rounded-sm text-xl px-[5.4%] bg-[#518b61] flex flex-row font-bold mb-[3vh]">
            <span className="flex flex-col font-lexend py-[8%] md:py-[5%] text-[clamp(20px,2.5vw,45px)] xl:text-[clamp(20px,2.7vw,65px)] flex-1 min-w-0">
              <p className="animate-slideInLeft sm:pb-[3%] md:pb-[8%] whitespace-normal break-words">
                {members_info[activeTab].first_name}
              </p>
              <p className="animate-slideIn_Leftdelay whitespace-normal break-words">
                {members_info[activeTab].last_name}
              </p>
            </span>

                        <img
                            src={members_info[activeTab].src}
                            alt="profile"
                            className=" animate-zoomIn ml-auto rounded-sm relative z-10 w-[18vw] max-w-[200px] h-auto object-contain"
                        />


                    </div>

                    <div className="flex rounded-lg flex-wrap gap-2 bg-[#6b9f7b] mb-[3vh] py-[4vh] xl:py-[3vh] px-[5.4%] font-cousine text-[clamp(9px,10vw,17px)] xl:text-[clamp(18px,10vw,20px)]">
                        <span className="text-gray-300 flex flex-wrap tracking-widest">Email:</span>
                        <span className="animate-slideInLeft text-white flex flex-wrap">{members_info[activeTab].email}</span>
                    </div>

                    <div className="flex rounded-lg flex-wrap gap-2 bg-[#6b9f7b] mb-[3vh] py-[4vh] xl:py-[3vh] px-[5.4%] font-cousine text-[clamp(9px,10vw,17px)] xl:text-[clamp(18px,10vw,20px)]">
                        <span className=" text-gray-300 flex flex-wrap tracking-widest">GitHub:</span>
                        {members_info[activeTab] && (
                            <a href={members_info[activeTab].github} className="animate-slideInLeft text-[#364e3d] hover:underline" target="_blank" rel="noopener noreferrer">
                                {members_info[activeTab].github_name}
                            </a>
                        )}
                    </div>

                    <div className="flex rounded-lg flex-wrap gap-2 bg-[#6b9f7b] mb-[3vh] py-[4vh] xl:py-[3vh] px-[5.4%] font-cousine text-[clamp(9px,10vw,17px)] xl:text-[clamp(18px,10vw,20px)]">
                        <span className="text-gray-300 flex flex-wrap tracking-widest">University:</span>
                        <a href="https://www.ku.ac.th/en/community-home" className="animate-slideIn_Leftdelay text-[#364e3d] hover:underline">
                            Kasetsart University - Bangkhen campus
                        </a>
                    </div>

                    <div className="flex rounded-lg flex-wrap gap-2 bg-[#6b9f7b] mb-[3vh] py-[4vh] xl:py-[3vh] px-[5.4%] font-cousine text-[clamp(9px,10vw,17px)] xl:text-[clamp(18px,10vw,20px)]">
                        <span className="text-gray-300 flex flex-wrap tracking-widest">Faculty:</span>
                        <a href="https://cpe.ku.ac.th/index.php/ske/" className="animate-slideIn_Leftdelay text-[#364e3d] hover:underline">
                            Software and Knowledge Engineering
                        </a>
                    </div>


                </div>
            </div>


            {/* Third section - back to previous page  */}
            <div className=" md:mx-[6vw] py-[10%] pt-[30%] md:pt-[10%] flex flex-col md:flex-row ">
                <div className="flex tracking-widest flex-col px-[6vw] md:px-[2vw] text-center justify-center font-back items-center text-white font-lexend md:basis-[70%] md:h-auto text-[clamp(19px,5vw,35px)] overflow-hidden">
                    <p>Are you ready to <span> {location.state?.from === "/tableandtask" ? "continue" : "start" } </span> your
                        <span className="ml-[2vw] tracking-widest md:ml-[2vw] bg-gradient-to-r from-[#6b9e7b] to-yellow-400 bg-clip-text text-transparent ">
                Planning?
              </span>
                    </p>
                </div>


                <div className="my-[5%] md:my-0 md:w-[30%] flex items-center justify-center">
                    <NavLink
                        to={location.state?.from === "/tableandtask" ? "/tableandtask" : "/"}
                        className={({ isActive }) =>`font-cousine rounded-md border border-white/15 bg-[#3a5e45] py-[0.7em] px-[6vw] text-[clamp(8px,8vw,20px)] ${isActive ? "text-white " : " text-zinc-200 hover:bg-[#2bb75a] hover:text-white hover:scale-125 transition-transform duration-300 "}`}>
                        Return
                    </NavLink>
                </div>
            </div>

            <footer className="border-t border-white/10">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 text-sm text-zinc-400">
                    © {new Date().getFullYear()} UniPlan · All rights reserved
                </div>
            </footer>
        </div>
    );
}
