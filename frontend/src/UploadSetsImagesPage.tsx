import React, { useState } from 'react';

export default function UploadSetsImagesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) setFile(e.target.files[0]);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setMessage('Please select a CSV file.');
      return;
    }
    const form = new FormData();
    form.append('file', file);

    try {
      const resp = await fetch('/api/upload-sets-images', {
        method: 'POST',
        body: form
      });
      if (resp.ok) {
        const text = await resp.text();
        setMessage(text);
      } else {
        setMessage('Error uploading CSV.');
      }
    } catch {
      setMessage('Network error.');
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Upload Sets Images CSV</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <input type="file" accept=".csv" onChange={onChange} className="block" />
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
          Upload
        </button>
      </form>
      {message && <p className="mt-4 text-blue-600">{message}</p>}
    </div>
  );
}
