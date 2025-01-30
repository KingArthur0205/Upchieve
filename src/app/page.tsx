"use client";

import { useState, useEffect } from "react";

interface Essay {
  essay_id: string;
  essay: string;
  excerpt: string;
  comment: string;
  ideas: boolean;
  organization: boolean;
  conventions: boolean;
  voice: boolean;
  word_choice: boolean;
  sentence_fluency: boolean;
  [key: string]: any;
}

export default function EssayReview() {
  const [essays, setEssays] = useState<Essay[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSelections, setCurrentSelections] = useState({
    ideas: false,
    organization: false,
    conventions: false,
    voice: false,
    word_choice: false,
    sentence_fluency: false,
  });

  useEffect(() => {
    fetchEssays();
  }, []);

  const fetchEssays = async () => {
    const response = await fetch("/api/sheets");
    const data = await response.json();
    const headers = data[0];
    const essays = data.slice(1).map((row: any[]) => {
      const essay: any = {};
      headers.forEach((header: string, index: number) => {
        essay[header] = row[index];
      });
      return essay;
    });
    setEssays(essays);
  };

  const handleCheckboxChange = (category: string) => {
    setCurrentSelections((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleSubmit = async () => {
    try {
      const rowNumber = currentIndex + 2;
      const values = [
        [
          currentSelections.ideas ? "TRUE" : "FALSE",
          currentSelections.organization ? "TRUE" : "FALSE",
          currentSelections.conventions ? "TRUE" : "FALSE",
          currentSelections.voice ? "TRUE" : "FALSE",
          currentSelections.word_choice ? "TRUE" : "FALSE",
          currentSelections.sentence_fluency ? "TRUE" : "FALSE",
        ],
      ];

      await fetch("/api/sheets", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          range: `Sheet1!J${rowNumber}:O${rowNumber}`,
          values,
        }),
      });

      setCurrentIndex((prev) => Math.min(prev + 1, essays.length - 1));
      setCurrentSelections({
        ideas: false,
        organization: false,
        conventions: false,
        voice: false,
        word_choice: false,
        sentence_fluency: false,
      });
    } catch (error) {
      console.error("Error updating sheet:", error);
    }
  };

  const currentEssay = essays[currentIndex];

  if (!currentEssay) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-4 text-lg">
        Essay {currentIndex + 1} of {essays.length}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Essay</h2>
        <p className="whitespace-pre-wrap mb-8">{currentEssay.essay}</p>

        <h2 className="text-xl font-bold mb-4">Excerpt</h2>
        <p className="whitespace-pre-wrap mb-8">{currentEssay.excerpt}</p>

        <h2 className="text-xl font-bold mb-4">Comment</h2>
        <p className="whitespace-pre-wrap">{currentEssay.comment}</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          {Object.entries(currentSelections).map(([category, checked]) => (
            <label key={category} className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => handleCheckboxChange(category)}
                className="w-4 h-4"
              />
              <span className="capitalize">{category.replace("_", " ")}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
            disabled={currentIndex === 0}
            className={`px-4 py-2 rounded ${
              currentIndex === 0
                ? "bg-gray-200 cursor-not-allowed"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            Previous
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Submit & Next
          </button>
        </div>
      </div>
    </div>
  );
}
