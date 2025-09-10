import { useNavigate } from "react-router-dom";
import AdobeStock_433725201 from "./assets/AdobeStock_433725201.jpeg";

export default function About() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        backgroundImage: `url(${AdobeStock_433725201})`,
        backgroundSize: "cover",       // stretch to cover the whole container
        backgroundPosition: "center",  // center the image
        backgroundRepeat: "no-repeat",
      }}
    >
      <div
        className="p-8 rounded-lg shadow-md w-full max-w-2xl overflow-y-auto text-white"
        style={{ backgroundColor: "#2a8d5c" }}
      >
        <h1 className="text-3xl font-bold mb-4 text-center">About Us</h1>

        {/* Background */}
        <h2 className="text-2xl font-bold mb-2">Background</h2>
        <p className="mb-6">
          University students often need a timetable for classes and a task tracker for homework. Most tools keep these separate, forcing students to manually connect assignments with the related class. This leads to missed deadlines, confusion, and extra work.

        </p>

        {/* Objective */}
        <h2 className="text-2xl font-bold mb-2">Objective</h2>
        <p className="mb-6">
          To address the issue of missed deadlines, overwhelm, and confusion caused by the need to manage multiple timetables, particularly for university students, because most existing tools keep class schedules and task deadlines separate. Therefore, we aim to develop an all-in-one application that integrates both class schedules and task tracking into a single, unified timetable.
        </p>

        {/* Contact */}
        <h2 className="text-2xl font-bold mb-2">Contact</h2>
        <ul className="list-disc list-inside mb-6 space-y-1">
          <li>pannawit.m@ku.th</li>
          <li>sugarduck500@gmail.com</li>
          <li>panthat.k@gmail.com</li>
          <li>sorasit.ka@ku.th</li>
        </ul>

        {/* Navigation button */}
        <div className="grid gap-2 mt-6">
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-black"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
