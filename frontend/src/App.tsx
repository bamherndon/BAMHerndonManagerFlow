import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage            from './HomePage';
import UploadPOPage        from './UploadPOPage';
import ReviewListPage      from './ReviewListPage';
import ReviewPage          from './ReviewPage';
import UploadToyhousePage  from './UploadToyhousePage';
import UploadSetsImagesPage from './UploadSetsImagesPage';
import LoginPage           from './LoginPage';

export function App() {
  return (
    <Router>
      <header className="bg-blue-600 text-white p-4 flex flex-wrap gap-2">
        <Link to="/"                       className="font-bold text-xl">Workflow App</Link>
        <nav className="flex flex-wrap gap-2 ml-auto">
          <Link to="/workflow/submit-heartland-import"  className="px-3 py-1 bg-blue-800 rounded hover:bg-blue-700">Submit Heartland PO import for review</Link>
          <Link to="/workflow/review-heartland-import"  className="px-3 py-1 bg-blue-800 rounded hover:bg-blue-700">Review Heartland Import</Link>
          <Link to="/workflow/upload-toyhouse"          className="px-3 py-1 bg-blue-800 rounded hover:bg-blue-700">Upload ToyHouse Data</Link>
          <Link to="/workflow/upload-sets-images"       className="px-3 py-1 bg-blue-800 rounded hover:bg-blue-700">Upload Sets Images</Link>
          <Link to="/login-heartland"                   className="px-3 py-1 bg-green-600 rounded hover:bg-green-500">Login to Heartland</Link>
        </nav>
      </header>

      <main className="p-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/workflow/submit-heartland-import"    element={<UploadPOPage />} />
          <Route path="/workflow/review-heartland-import"    element={<ReviewListPage />} />
          <Route path="/workflow/review-heartland-import/:po" element={<ReviewPage />} />
          <Route path="/workflow/upload-toyhouse"            element={<UploadToyhousePage />} />
          <Route path="/workflow/upload-sets-images"         element={<UploadSetsImagesPage />} />
          <Route path="/login-heartland"                     element={<LoginPage />} />
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
