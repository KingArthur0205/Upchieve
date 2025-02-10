"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Convert input to lowercase and remove whitespace
    const normalizedCode = code.toLowerCase().trim();

    // Check if the code matches the pattern "rater" followed by a number 1-5
    const match = normalizedCode.match(/^rater([1-5])$/);

    if (match) {
      const raterNumber = match[1];
      router.push(`/data/${raterNumber}`);
    } else {
      setError(
        'Invalid code. Please enter a code like "rater1", "rater2", etc.'
      );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Welcome!</h1>
      <p className="text-lg text-gray-700 mb-6">
        Please enter your rater code to view essays:
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(""); // Clear error when user types
            }}
            placeholder="Enter code (e.g., rater1)"
            className="px-4 py-3 text-lg border border-gray-300 text-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white text-lg font-semibold rounded-lg shadow-md hover:bg-blue-700 transition"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  );
}
