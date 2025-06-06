/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { useState } from "react";

export default function Home() {
  const [formData, setFormData] = useState({
    fullName: "",
    address: "",
    rent: "",
    startDate: "",
    endDate: "",
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setPdfFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) return alert("Please upload a PDF");

    const form = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      form.append(key, value);
    });
    form.append("pdfFile", pdfFile);

    setLoading(true);
    const res = await fetch("/api/verify", {
      method: "POST",
      body: form,
    });

    const data = await res.json();
    setResult(data);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-6">
      <div className="max-w-xl mx-auto bg-white p-8 rounded shadow">
        <h1 className="text-2xl font-bold mb-6">Tenancy Verifier</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="fullName"
            type="text"
            placeholder="Full Name"
            onChange={handleChange}
            required
            className="w-full p-2 border rounded"
          />
          <input
            name="address"
            type="text"
            placeholder="Property Address"
            onChange={handleChange}
            required
            className="w-full p-2 border rounded"
          />
          <input
            name="rent"
            type="number"
            placeholder="Monthly Rent Amount"
            onChange={handleChange}
            required
            className="w-full p-2 border rounded"
          />
          <input
            name="startDate"
            type="date"
            placeholder="Tenancy Start Date"
            onChange={handleChange}
            required
            className="w-full p-2 border rounded"
          />
          <input
            name="endDate"
            type="date"
            placeholder="Tenancy End Date"
            onChange={handleChange}
            className="w-full p-2 border rounded"
          />
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            required
            className="w-full p-2 border rounded"
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? "Verifying..." : "Verify Tenancy"}
          </button>
        </form>

        {result && (
          <div className="mt-6 p-4 border rounded bg-gray-100">
            <h2 className="font-bold mb-2">Verification Results:</h2>
            <pre className="text-sm whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
