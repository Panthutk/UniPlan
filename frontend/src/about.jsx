import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import Pic1 from "./assets/pic1.png";
import Pic2 from "./assets/pic2.png";
import Pic3 from "./assets/pic3.jpg";
import Pic4 from "./assets/pic4.png";



export default function About() {
  const members = [
    { id: 1, src: Pic1, name: "Pannawit Mahacharoensiri", email: "pannawit.m@ku.th" },
    { id: 2, src: Pic2, name: "Jongchana Khachatrokphai", email: "jongchana.kh@ku.th" },
    { id: 3, src: Pic3, name: "Panthut Ketphan", email: "panthut.k@ku.th" },
    { id: 4, src: Pic4, name: "Sorasit Kateratorn", email: "sorasit.ka@ku.th" },
  ];
  const navigate = useNavigate();

  return (
    // Background color
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      {/*Navbar copy from Login.jsx*/}
      <header className="fixed top-0 inset-x-0 z-50 bg-zinc-900/70 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to="/tableandtask" className="font-black tracking-wide text-3xl sm:text-4xl">LOGO</Link>
              <nav className="flex items-center gap-3">
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `rounded-md border border-white/15 px-3 py-1.5 text-sm ${isActive ? "bg-white/10 text-white" : "text-zinc-200 hover:bg-white/5"
                    }`
                  }
                >
                  Login
                </NavLink>
              </nav>
          </div>
        </div>
      </header>

      {/* Feature advertised block */}
      <div className="flex justify-center w-full pt-16">
        <div className="relative w-full min-h-[500px]">
          {/* Shadow rectangle */}
          <div 
            className="absolute top-5 left-4 w-[calc(100%-1rem)] h-full rounded-3xl"
            style={{ backgroundColor: "#3e6d4a" }}>
            </div>
            {/* Main card */}
            <div
              className="relative w-full h-full rounded-3xl flex flex-col items-center p-8"
              style={{ backgroundColor: "#578f67" }}>
                <p className="font-black tracking-wide sm:text-9xl text-white pt-[90px] z-10">
                  UNIPLAN 
                </p>
                
                <div className="mt-8 flex flex-col sm:flex-row items-center gap-6">
                  <p className="font-bold text-xl">
                    <span className="text-5xl text-[#fde68a]">INTER</span>
                    <span className="text-5xl text-[#f472b6]">ACTIVE</span><br/>
                    <span className="text-5xl text-[#34d399]">TIMETABLE</span>
                    <span className="text-5xl text-[#fbbf24]"> & TASK</span>
                  </p>

                  <span className="bg-gradient-to-r from-[#fbdf24] to-[#60c3fa] font-bold text-9xl mx-4 
                  bg-clip-text text-transparent transition delay-150 duration-300 ease-in-out hover:scale-150">+</span>
                  
                  <p className="font-bold text-xl">
                    <span className="text-5xl text-[#60a5fa]">CLASS</span>
                    <span className="text-5xl text-[#a78bfa]">ROOM</span><br/>
                    <span className="text-5xl text-[#f87171]">SYNCHRONIZE</span>
                  </p>
                </div>

            </div>
          </div>
        </div>

      {/* First text box : What we do */}
      <div className="mt-16 w-full px-3 sm:px-8">
        <header className="bg-transparent p-5">
          <h1 className="text-[#3e6d4a] text-5xl font-bold tracking-wide">
            WHAT  WE  DO
          </h1>
        </header>
        <p className="text-white my-10 text-xl w-full px-[100px] leading-normal">
          We developed an "Integrated platform" that combines <br/>
          task management with class timetables,<br />
          designed to help users stay organized with ease.
        </p>
        <ul className=" list-disc list-inside mb-[130px] text-base w-full px-[100px] text-[#578f67] ">
          <li className="leading-loose">Users will have the ability to add, remove, and modify classes directly within the timetable.</li>
          <li className="leading-loose">Homework assignments can be created directly from a class block on the timetable.</li>
          <li className="leading-loose">Users will receive email notifications via Gmail regarding upcoming task due dates.</li>
          <li className="leading-loose">Classroom subjects and assignments will be automatically synced and available for selection on the website.</li>
        </ul>
      </div>

      {/* Second text box : Why we do*/}
      <div className="w-full px-3 sm:px-8 min-h-[700px]" style={{ backgroundColor: "#212121" }}>
          {/*Header*/}
          <header className="bg-transparent p-5 text-center">
            <h1 className="text-[#3e6d4a] mt-9 text-5xl font-bold tracking-wide">
              WHY WE DO
            </h1>
          </header>

          {/*Seperate each reason to be 3 reasons*/}
            <div className="flex flex-col md:flex-row justify-center md:items-stretch items-center gap-20 mt-10 min-h-[400px]">
              <ReasonCard info_text="Losing track of assignments because of due dates negatively impacts students’ performance and overall academic success, leading to more and more problems."/>
              <ReasonCard info_text="Many students struggle to manage multiple timetables and assignment deadlines, which can lead to stress, panicky,disorganization, and overlooked tasks."/>
              <ReasonCard info_text="There are currently no applications that integrate Google Classroom with timetables and task management, which is why we decided to develop one ourselves."/>
            </div>
      </div>

      
      {/* Third text box: Who are we */}
      <div className="mt-8 w-full px-3 sm:px-8 min-h-[650px]">
        <header className="bg-transparent p-5 flex justify-end">
          <h1 className="text-[#3e6d4a] text-5xl font-bold tracking-wide">
            WHO WE ARE
          </h1>
        </header>

        {/* Flex container for left-right */}
        <MemberInfo members={members} />

      </div>
      
      <div className="w-full flex justify-center p-12">
        <Link to="/" className="hover:scale-105 text-[#578f67] hover:text-[#709c7c] text-3xl px-6 py-3 rounded-lg transition">
          &lt;LOGIN PAGE
        </Link>
      </div>

    </div>
  );
}

function ReasonCard({info_text}) {
  return (
    <div className="p-6 flex rounded-2xl shadow-md transform items-center text-center justify-center transition-transform 
    duration-300 bg-[#40704e] hover:scale-125 hover:bg-[#24452d] w-72 break-words" >
      <h2 className="text-xl mb-2 leading-loose">{info_text}</h2>
    </div>
  )
}

function MemberInfo({ members }) {
  const [active, setActive] = useState(members[3]?.id || null); // default first

  return (
    <div className=" pl-[100px] flex flex-col md:flex-row mt-8 gap-6 w-full min-h-[500px]">
      {/* Left: stacked pictures */}
      <div className="md:w-2/3 relative h-[500px] flex items-start justify-start">
        {members.map((m, index) => (
          <img
            key={m.id}
            src={m.src}
            alt={m.name}
            onClick={() => setActive(m.id)}
            className={`absolute rounded-lg object-cover cursor-pointer transition-all duration-500
              ${active === m.id ? "w-[40%] h-[90%]" : "w-[30%] h-[70%] contrast-50"}
            `}
            style={{
              left: `${index * 150}px`,
              top: `${index * 15}px`,
              zIndex: active === m.id ? 50 : index,
            }}
          />
        ))}
      </div>

      {/* Right: member info */}
      <div className="md:w-1/3 flex flex-col">
        <h2 className="px-6 text-3xl font-semibold text-[#578f67]">Name:</h2>
        <p className="px-10 mt-6 mb-4 text-xl bg-transparent">
          {members.find((m) => m.id === active)?.name}
        </p>

        <h2 className="px-6 text-3xl font-semibold text-[#578f67]">Email:</h2>
        <p className="px-10 mt-6 mb-4 text-xl bg-transparent">
          {members.find((m) => m.id === active)?.email}
        </p>
      </div>
    </div>
  );
}