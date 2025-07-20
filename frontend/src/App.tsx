import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import UploadPOPage from './UploadPOPage';
import ReviewPage from './ReviewPage';
import UploadToyhousePage from './UploadToyhousePage';

export function App() {
  return (
    <Router>
      <header className="bg-blue-600 text-white p-4 flex justify-between">
        <h1 className="text-xl font-bold">Workflow App</h1>
        <nav>
          <Link to="/" className="px-3 py-1 hover:underline">
            Home
          </Link>
          <Link
            to="/workflow/heartland-import"
            className="px-3 py-1 bg-blue-800 rounded hover:bg-blue-700 ml-2"
          >
            Start Heartland Import
          </Link>
          <Link
            to="/workflow/upload-toyhouse"
            className="px-3 py-1 bg-blue-800 rounded hover:bg-blue-700 ml-2"
          >
            Upload ToyHouse Data
          </Link>
        </nav>
      </header>

      <main className="p-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/workflow/heartland-import" element={<UploadPOPage />} />
          <Route path="/workflow/review" element={<ReviewPage />} />
          <Route path="/workflow/upload-toyhouse" element={<UploadToyhousePage />} />
        </Routes>
      </main>
    </Router>
  );
}

function HomePage() {
  return (
    <div className="text-center">
      <h2 className="text-lg font-semibold">Welcome to Workflow App</h2>
      <p>Select a workflow from the menu above to get started.</p>
    </div>
  );
}
