import React, { useState } from "react";

export default function UploadToyhousePage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setMessage("Please select a CSV file to upload.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload-toyhouse-csv", {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        setMessage("ToyHouse master data CSV uploaded successfully!");
      } else {
        setMessage("Error uploading CSV.");
      }
    } catch (error) {
      console.error(error);
      setMessage("Network error: Unable to upload CSV.");
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">
        Upload ToyHouse Master Data CSV
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="block"
        />
        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Upload
        </button>
      </form>
      {message && (
        <p className="mt-4 text-blue-600">{message}</p>
      )}
    </div>
  );
}
