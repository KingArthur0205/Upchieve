"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface Essay {
  essay_id: string;
  essay: string;
  excerpt: string;
  comment: string;
  [key: string]: any;
}

const TRAITS = [
  "Ideas",
  "Organization",
  "Conventions",
  "Voice",
  "Word Choice",
  "Sentence Fluency",
];

export default function EssayReview() {
  const { rater } = useParams();

  const [essays, setEssays] = useState<Essay[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isEssayExpanded, setIsEssayExpanded] = useState(false);
  const [sentenceSelections, setSentenceSelections] = useState<string[]>([]);

  useEffect(() => {
    fetchEssays();
  }, []);

  const fetchEssays = async () => {
    const response = await fetch(`/api/sheets/${rater}`);
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

  const highlightExcerpt = (essay: string, excerpt: string) => {
    if (!excerpt.trim()) return essay;
    const escapedExcerpt = excerpt.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    const regex = new RegExp(`(${escapedExcerpt})`, "gi");
    return essay.split(regex).map((part, index) =>
      regex.test(part) ? (
        <strong key={index} className="bg-yellow-200">
          {part}
        </strong>
      ) : (
        part
      )
    );
  };

  const handleTraitChange = (index: number, trait: string) => {
    setSentenceSelections((prev) => {
      const newSelections = [...prev];
      newSelections[index] = trait;
      return newSelections;
    });
  };

  const handleSubmit = async () => {
    try {
      const rowNumber = currentIndex + 2;
      const values = [sentenceSelections];

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
      setSentenceSelections([]);
    } catch (error) {
      console.error("Error updating sheet:", error);
    }
  };

  const splitIntoSentences = (text: string) => {
    console.log("text", text);
    return text.match(/[^.!?]+[.!?]?[”’"']*/g) || [];
  };

  const currentEssay = essays[currentIndex];
  if (!currentEssay) return <div>Loading...</div>;

  const sentences = splitIntoSentences(currentEssay.comment);

  return (
    <div className="mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800 text-right">
          {currentIndex + 1} of {essays.length}
        </h1>
      </div>

      {/* Collapsible Essay Section */}
      <div className="bg-white rounded-lg shadow-md mb-6 overflow-hidden">
        <button
          onClick={() => setIsEssayExpanded(!isEssayExpanded)}
          className="w-full p-4 flex justify-between items-center hover:bg-gray-50 transition-colors"
        >
          <span className="font-semibold text-gray-700">Full Essay</span>
          <span className="text-2xl text-gray-500">
            {isEssayExpanded ? "−" : "+"}
          </span>
        </button>
        {isEssayExpanded && (
          <div className="p-4 border-t border-gray-100">
            <p className="whitespace-pre-wrap text-gray-600">
              {highlightExcerpt(currentEssay.essay, currentEssay.excerpt)}
            </p>
          </div>
        )}
      </div>

      {/* Excerpt Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-l font-bold mb-4 text-gray-800">Excerpt</h2>
        <p className="text-gray-600">{currentEssay.excerpt}</p>
      </div>

      {/* Comment Section with Dropdowns */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-l font-bold mb-4 text-gray-800">Comments</h2>
        <div className="space-y-4">
          {sentences.map((sentence, index) => (
            <div key={index} className="flex items-center justify-between">
              <p className="text-gray-600 w-3/4">{sentence.trim()}</p>
              <select
                className="border border-gray-300 p-2 rounded-lg text-gray-700"
                value={sentenceSelections[index] || ""}
                onChange={(e) => handleTraitChange(index, e.target.value)}
              >
                <option value="">Select Trait</option>
                {TRAITS.map((trait) => (
                  <option key={trait} value={trait}>
                    {trait}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4 border-t border-gray-100">
        <button
          onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
          disabled={currentIndex === 0}
          className={`px-6 py-2 rounded-lg transition-colors ${
            currentIndex === 0
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Previous
        </button>
        <button
          onClick={handleSubmit}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Submit & Next
        </button>
      </div>
    </div>
  );
}
