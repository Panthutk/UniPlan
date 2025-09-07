import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import { Button as ShadButton } from "./components/ui/button";

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-3xl font-bold mb-4 text-center">About US</h1>
        <p className="text-lg text-center mb-6">
          Contract work for UniPlan project.
        </p>



        {/* Navigation buttons below form */}
        <div className="grid gap-2 mt-6">
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Back to Home
          </button>


        </div>
      </div>
    </div>
  );
}
