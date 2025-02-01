"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface Essay {
  essay_id: string;
  grade: string;
  instructions: string;
  essay: string;
  excerpt: string;
  comment: string;
  tid: string;
  isRepresentative: string;
  comment_id: string;
  ideas: "0" | "1";
  organization: "0" | "1";
  voice: "0" | "1";
  word_choice: "0" | "1";
  sentence_fluency: "0" | "1";
  conventions: "0" | "1";
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
  const [essayIds, setEssayIds] = useState<string[]>([]);
  const [currentEssayId, setCurrentEssayId] = useState("");
  const [isEssayExpanded, setIsEssayExpanded] = useState(false);
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);

  const fetchEssays = async () => {
    const response = await fetch(`/api/sheets/${rater}`);
    const data = await response.json();
    console.log("data: ", data);
    const headers = data[0] as Array<keyof Essay>;

    const essays = data.slice(1).map((row: string[] & "0" & "1") => {
      const essay = {} as Essay;
      console.log("row: ", row);

      headers.forEach((header: keyof Essay, index: number) => {
        essay[header] = row[index];
      });

      return essay;
    });

    setEssayIds(essays.map((essay: Essay) => essay.essay_id));
    setCurrentEssayId(essays[0].essay_id);
    setEssays(essays);
  };

  useEffect(() => {
    fetchEssays();
  }, []);

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
    setSelectedTraits((prev) => {
      const newSelections = [...prev];
      newSelections[index] = trait;
      return newSelections;
    });
  };

  const handleSubmit = async () => {
    try {
      await fetch(`/api/sheets/${rater}/annotate`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentEssay,
          selectedTraits,
        }),
      });

      const essayIdsUpdate = essayIds.filter(
        (essayId) => essayId !== currentEssayId
      );

      setEssayIds(essayIdsUpdate);
      setCurrentEssayId(essayIdsUpdate[0]);
      setSelectedTraits([]);
    } catch (error) {
      console.error("Error updating sheet:", error);
    }
  };

  const splitIntoSentences = (text: string) => {
    return text.match(/[^.!?]+[.!?]?[”’"']*/g) || [];
  };
  console.log("currentEssayId: ", currentEssayId);
  const currentEssay = essays?.find(
    (essay) => essay.essay_id === currentEssayId
  );
  console.log("currentEssay: ", currentEssay);
  if (!currentEssay) return <div>Loading...</div>;

  const sentences = splitIntoSentences(currentEssay.comment);

  return (
    <div className="mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800 text-right">
          {currentEssayId + 1} of {essays.length}
        </h1>
      </div>

      {/* Collapsible Essay Section */}
      <div className="bg-white rounded-lg shadow-md mb-6 overflow-hidden">
        <button
          onClick={() => setIsEssayExpanded(!isEssayExpanded)}
          className="w-full p-4 flex justify-between items-center hover:bg-gray-50 transition-colors"
        >
          <span className="font-semibold text-gray-700">{`Essay ${currentEssay.essay_id}`}</span>
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
                value={selectedTraits[index] || ""}
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
          onClick={() => setCurrentEssayId((prev) => Math.max(prev - 1, 0))}
          disabled={currentEssayId === 0}
          className={`px-6 py-2 rounded-lg transition-colors ${
            currentEssayId === 0
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
