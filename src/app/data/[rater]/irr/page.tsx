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

interface LabeledComment {
  sentences: string[];
  labels: string[];
  comment_id: string;
  excerpt: string;
}

const TRAITS = [
  "Ideas",
  "Organization",
  "Conventions",
  "Voice",
  "Word Choice",
  "Sentence Fluency",
];

export default function IRREssayReview() {
  const params = useParams<{ rater: string }>();
  const rater = params?.rater;

  const [allEssays, setAllEssays] = useState<Essay[]>([]);
  const [essayIds, setEssayIds] = useState<string[]>([]);
  const [currentEssays, setCurrentEssays] = useState<Essay[]>([]);
  const [currentEssayId, setCurrentEssayId] = useState("");
  const [isEssayExpanded, setIsEssayExpanded] = useState(false);
  const [currentCommentIndex, setCurrentCommentIndex] = useState(0);
  const [labeledComments, setLabeledComments] = useState<LabeledComment[]>([]);
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEssays = async () => {
    try {
      const response = await fetch(`/api/sheets/${rater}/irr`);
      if (!response.ok) {
        throw new Error(`Failed to fetch essays: ${response.statusText}`);
      }
      const data = await response.json();
      const headers = data[0] as Array<keyof Essay>;
      const essays: Essay[] = data.slice(1).map((row: string[] & "0" & "1") => {
        const essay = {} as Essay;
        headers.forEach((header: keyof Essay, index: number) => {
          essay[header] = row[index];
        });
        return essay;
      });

      setEssayIds(essays.map((essay: Essay) => essay.essay_id));
      setCurrentEssayId(essays[0].essay_id);
      setCurrentEssays(
        essays.filter((essay) => essay.essay_id === essays[0].essay_id)
      );
      setAllEssays(essays);
      setError(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load essays";
      setError(errorMessage);
      console.error("Error fetching essays:", error);
    } finally {
      setIsInitialLoading(false);
    }
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

  const handlePreviousCommentTraitChange = (
    commentId: string,
    sentenceIndex: number,
    newTrait: string
  ) => {
    setLabeledComments((prev) =>
      prev.map((comment) => {
        if (comment.comment_id === commentId) {
          const newLabels = [...comment.labels];
          newLabels[sentenceIndex] = newTrait;
          return { ...comment, labels: newLabels };
        }
        return comment;
      })
    );
  };

  const splitIntoSentences = (text: string) => {
    return text.match(/[^.!?]+[.!?]?["'"']*/g) || [];
  };

  const isCurrentCommentFullyLabeled = () => {
    const currentSentences = splitIntoSentences(
      currentEssays[currentCommentIndex]?.comment || ""
    );
    return (
      selectedTraits.length === currentSentences.length &&
      selectedTraits.every((trait) => trait !== "")
    );
  };

  const handleSubmit = async () => {
    if (!isCurrentCommentFullyLabeled() || isSubmitting) return;

    const currentComment = currentEssays[currentCommentIndex];
    const sentences = splitIntoSentences(currentComment.comment);
    const isLastComment = currentCommentIndex === currentEssays.length - 1;

    // For non-last comments, just update the state and move to next comment
    if (!isLastComment) {
      setLabeledComments((prev) => [
        ...prev,
        {
          sentences,
          labels: [...selectedTraits],
          comment_id: currentComment.comment_id,
          excerpt: currentComment.excerpt,
        },
      ]);
      setCurrentCommentIndex((prev) => prev + 1);
      setSelectedTraits([]);
      return;
    }

    // For the last comment, handle the final submission
    const confirmSubmit = window.confirm(
      `You are about to submit all labeled comments for Essay ${currentEssayId}. This action cannot be undone. Would you like to proceed?`
    );

    if (confirmSubmit) {
      setIsSubmitting(true);
      setError(null);

      try {
        const response = await fetch(`/api/sheets/${rater}/irr/annotate`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            essayId: currentEssayId,
            labeledComments: [
              ...labeledComments,
              {
                sentences,
                labels: [...selectedTraits],
                comment_id: currentComment.comment_id,
                excerpt: currentComment.excerpt,
                comment: currentComment.comment,
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to submit labels: ${response.statusText}`);
        }

        // Only update state after successful submission
        const essayIdsUpdate = essayIds.filter(
          (essayId) => essayId !== currentEssayId
        );

        const newCurrentEssayId = essayIdsUpdate[0];

        setEssayIds(essayIdsUpdate);
        setCurrentEssayId(newCurrentEssayId);
        setCurrentEssays(
          allEssays.filter((essay) => essay.essay_id === newCurrentEssayId)
        );
        setCurrentCommentIndex(0);
        setLabeledComments([]);
        setSelectedTraits([]);
        setError(null);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to submit labels";
        setError(errorMessage);
        console.error("Error updating sheet:", error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const toggleEditComment = (commentId: string) => {
    setEditingCommentId(editingCommentId === commentId ? null : commentId);
  };

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading essays...</p>
        </div>
      </div>
    );
  }

  const currentEssay = currentEssays[currentCommentIndex];
  if (!currentEssay) return <div>Loading...</div>;

  const currentSentences = splitIntoSentences(currentEssay.comment);
  const isSubmitEnabled = isCurrentCommentFullyLabeled() && !isSubmitting;
  const isLastComment = currentCommentIndex === currentEssays.length - 1;

  return (
    <div className="mx-auto p-6 bg-gray-50 min-h-screen">
      {error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6"
          role="alert"
        >
          <p>{error}</p>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800 text-right">
          Essay {currentEssayId} - Comment {currentCommentIndex + 1} of{" "}
          {currentEssays.length}
        </h1>
      </div>

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

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <p className="text-gray-600 mb-4 italic">
          Excerpt: {currentEssay.excerpt}
        </p>

        <div className="space-y-4 pt-4">
          {currentSentences.map((sentence, index) => (
            <div key={index} className="flex items-center justify-between">
              <p className="text-gray-600 w-3/4">{sentence.trim()}</p>
              <select
                className="border border-gray-300 p-2 rounded-lg text-gray-700"
                value={selectedTraits[index] || ""}
                onChange={(e) => handleTraitChange(index, e.target.value)}
                disabled={isSubmitting}
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
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSubmit}
            disabled={!isSubmitEnabled}
            className={`px-6 py-2 rounded-lg transition-colors flex items-center ${
              isSubmitEnabled
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isSubmitting && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            )}
            {isSubmitting
              ? "Submitting..."
              : isLastComment
              ? "Submit All Labels"
              : "Next Comment"}
          </button>
        </div>
      </div>

      {labeledComments.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-l font-bold mb-4 text-gray-800">
            Previous Comments
          </h2>
          {labeledComments.map((comment) => (
            <div key={comment.comment_id} className="py-4 last:mb-0 border-t">
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm text-gray-500 italic">
                  Excerpt: {comment.excerpt}
                </div>
                <button
                  onClick={() => toggleEditComment(comment.comment_id)}
                  className="text-blue-500 hover:text-blue-600 text-sm"
                  disabled={isSubmitting}
                >
                  {editingCommentId === comment.comment_id ? "Done" : "Edit"}
                </button>
              </div>
              {comment.sentences.map((sentence, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between mb-2"
                >
                  <p className="text-sm text-gray-600 w-3/4">
                    {sentence.trim()}
                  </p>
                  {editingCommentId === comment.comment_id ? (
                    <select
                      className="border border-gray-300 p-1 rounded text-sm text-gray-600"
                      value={comment.labels[index]}
                      onChange={(e) =>
                        handlePreviousCommentTraitChange(
                          comment.comment_id,
                          index,
                          e.target.value
                        )
                      }
                      disabled={isSubmitting}
                    >
                      {TRAITS.map((trait) => (
                        <option key={trait} value={trait}>
                          {trait}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-sm px-2 py-1 bg-gray-100 rounded text-gray-600">
                      {comment.labels[index]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
