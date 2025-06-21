"use client"; // Client Component

import { useEffect, useState } from "react";
import Image from "next/image";

interface Tab1Props {
  number: string | undefined;
  selectedSegment: string | undefined;
}

export default function Tab1({ number, selectedSegment }: Tab1Props) {
  const [lessonLink, setLessonLink] = useState<{ url: string; text: string } | null>(null);
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [lessonSegmentIDs, setLessonSegmentIDs] = useState<string[]>([]);

  useEffect(() => {
    if (!number || !selectedSegment) return; // Ensure the number is available

    // Fetch lesson link from content.json
    fetch(`/t${number}/content.json`)
      .then((res) => res.json())
      .then((data) => {
        setLessonLink(data.lessonLink);
      })
      .catch((err) => console.error("Error loading content:", err));

    // Fetch images and lesson segment IDs from images.json
    fetch(`/t${number}/images.json`)
      .then((res) => res.json())
      .then((data) => {
        setImagePaths(data[`t${number}`]); // Image paths
        setLessonSegmentIDs(data["segments"] || []); // Segment IDs
      })
      .catch((err) => console.error("Error loading images:", err));
  }, [number]); // Dependency array ensures this runs when `number` changes

  return (
    <div className="h-[80vh] overflow-y-auto p-6 border border-gray-300 rounded-md">
      <h2 className="text-xl font-semibold text-black">
        {lessonLink ? (
          <a
            href={lessonLink.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            {lessonLink.text}
          </a>
        ) : (
          "Loading lesson..."
        )}
      </h2>
      
      {/* Dynamically render images */}
      {imagePaths.length > 0 ? (
        imagePaths.map((src, index) => {
          const segmentID = lessonSegmentIDs[index];

          // Check if the segment should be displayed
          if (selectedSegment === "full_transcript" || selectedSegment === "student_only" || segmentID === selectedSegment) {
            return (
              <div key={index} className="my-4 text-center">
                <h3 className="text-lg font-semibold text-black mb-2">
                  Problem #{index + 1}
                  {segmentID && ` (Lesson Segment ID: ${segmentID})`}
                </h3>
                <Image src={src} alt={`Problem ${index + 1}`} width={500} height={300} />
              </div>
            );
          }
          return null; // Do not render if it doesn't match
        })
      ) : (
        <p className="text-gray-500 text-center mt-4">Loading images...</p>
      )}
    </div>
  );
}