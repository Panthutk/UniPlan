import { useNavigate } from "react-router-dom";

export default function About() {
  const navigate = useNavigate();

  return (
    // Background color
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      {/*Navbar copy from Login.jsx*/}
      <header className="fixed top-0 inset-x-0 z-50 bg-zinc-900/70 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <navigate to="/" className="font-black tracking-wide text-3xl sm:text-4xl">LOGO</navigate>
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
            className="relative w-full h-full rounded-3xl flex flex-col items-center justify-center p-8"
            style={{ backgroundColor: "#578f67" }}
          >
            <p className="font-black tracking-wide sm:text-9xl text-center text-white">
              L O G O
            </p>
          </div>
        </div>
      </div>

      {/* First text box : What we do */}
      <div className="mt-16 w-full px-3 sm:px-8">
        <header className="bg-transparent p-5">
          <h1 className="text-[#3e6d4a] text-6xl font-bold tracking-wide">
            WHAT WE DO
          </h1>
        </header>
        <p className="text-white my-8 text-3xl w-full px-[100px] leading-normal">
          We developed an "Integrated platform" that combines <br/>
          task management with class timetables,<br />
          designed to help users stay organized with ease.
        </p>
        <ul className="text-[#578f67] list-disc list-inside text-white mb-[140px] text-lg w-full px-[100px]">
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
            <h1 className="text-[#3e6d4a] mt-8 text-6xl font-bold tracking-wide">
              WHY WE DO
            </h1>
          </header>

          {/*Seperate each reason to be 3 reasons*/}
            <div className="flex justify-center space-x-20 mt-10 min-h-[400px]">
              <ReasonCard info_text="Reason 1: This is a longer text that should wrap nicely inside the card to multiple lines if needed."/>
              <ReasonCard info_text="Reason 2"/>
              <ReasonCard info_text="Reason 3"/>
            </div>
      </div>

      {/*Third text box : Who are we*/}
      <div className="mt-24 bg-transparent">

      </div>
      
    </div>
  );
}

function ReasonCard({info_text}) {
  return (
    <div className="p-6 rounded-xl shadow-md transform transition-transform duration-300 hover:scale-125 w-72 break-words" style={{ backgroundColor: "#40704e" }}>
      <h2 className="text-xl font-bold mb-2">{info_text}</h2>
    </div>
  )
}