import React from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";

export function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/step/:stepId" element={<WorkflowStep />} />
      </Routes>
    </Router>
  );
}

function StartPage() {
  const navigate = useNavigate();

  const startWorkflow = () => {
    navigate("/step/1");
  };

  return (
    <div className="p-4 text-center">
      <h1 className="text-xl font-bold mb-4">Start Workflow</h1>
      <button className="bg-blue-600 text-white p-2 rounded" onClick={startWorkflow}>
        Begin
      </button>
    </div>
  );
}

function WorkflowStep() {
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold">Step Placeholder</h2>
      <p>More details will be added here as you define the workflow steps.</p>
    </div>
  );
}