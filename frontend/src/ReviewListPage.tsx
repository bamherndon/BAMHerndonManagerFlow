import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type MasterEntry = {
  po_number: string;
  po_url: string | null;
  po_import_status: 'loaded' | 'reviewing' | 'reviewed';
};

export default function ReviewListPage() {
  const [entries, setEntries] = useState<MasterEntry[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/po-import-master')
      .then(res => res.json())
      .then(setEntries)
      .catch(err => console.error('Failed to fetch master entries:', err));
  }, []);

  const handleReview = async (po: string) => {
    // 1) mark as reviewing
    await fetch(`/api/po-import-master/${encodeURIComponent(po)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'reviewing' }),
    });
    // 2) navigate to review detail
    navigate(`/workflow/review-heartland-import/${encodeURIComponent(po)}`);
  };

  if (entries.length === 0) {
    return <div className="p-4">No PO imports yet.</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">
        Review Heartland Imports
      </h2>
      <ul className="space-y-2">
        {entries.map(entry => (
          <li
            key={entry.po_number}
            className="border p-4 rounded bg-white shadow flex justify-between items-center"
          >
            <div>
              {entry.po_url ? (
                <a
                  href={entry.po_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline mr-4"
                >
                  {entry.po_number}
                </a>
              ) : (
                <span className="font-medium mr-4">
                  {entry.po_number}
                </span>
              )}
              <span className="text-sm text-gray-600">
                Status:{' '}
                <span className="font-semibold text-gray-800">
                  {entry.po_import_status}
                </span>
              </span>
            </div>
            <button
              onClick={() => handleReview(entry.po_number)}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Review Items
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
