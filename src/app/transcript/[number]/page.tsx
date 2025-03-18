"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Modal from "../../components/Modal";
import Tab1 from "../../tabs/tab1";
import Tab2 from "../../tabs/tab2";
import Tab3 from "../../tabs/tab3";
import Papa from "papaparse";

interface CsvRow {
    "#": string;
    "In cue": string;
    "Out cue": string;
    "Speaker": string;
    "Dialogue": string;
    [key: string]: string; // For any other columns that might exist
  }

export default function TranscriptPage() {
  const params = useParams();
  const number = params.number as string;
  const [customText, setCustomText] = useState("");
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [speakerColors, setSpeakerColors] = useState<{ [key: string]: string }>({});
  
  const tabs = [
    { label: "Student-facing Lesson Prompts", key: "tab1", content:<Tab1 number={number} /> },
    { label: "Learning Goals", key: "tab2", content: <Tab2 number={number}/> },
    { label: "Common Core State Standards", key: "tab3", content: <Tab3 number={number}/> },
  ];

  // Table state to store user input in the last column
  const [tableData, setTableData] = useState(
    Array.from({ length: 3 }, (_, index) => ({
      col1: `Row ${index + 1} Col 1`,
      col2: `Row ${index + 1} Col 2`,
      col3: `Row ${index + 1} Col 3`,
      col4: `Row ${index + 1} Col 4`,
      col5: `Row ${index + 1} Col 5`,
      checked: false, // Checkbox column state
      col6: "", // Editable text field
    }))
  );

  // Update your isCheckboxDisabled function
  const isCheckboxDisabled = (speaker: string) => {
    // Check if the speaker string contains "Teacher" or "Unknown"
    return speaker.includes("Teacher") || speaker.includes("Unknown") || speaker.includes("Speaker");
  };

  // Handle checkbox state changes
  const handleCheckboxChange = (index: number) => {
    const updatedData = [...tableData];
    // Only allow changes if speaker is not in disabled list
    if (!isCheckboxDisabled(updatedData[index].col4)) {
      updatedData[index].checked = !updatedData[index].checked;
      setTableData(updatedData);
    }
  };
  
  // Handle text field changes
  const handleInputChange = (index: number, value: string) => {
    const updatedData = [...tableData];
    updatedData[index].col6 = value;
    setTableData(updatedData);
  };

  // Save Function (Stores data locally)
  const handleSave = () => {
    const dataToSave = { tableData, customText, email };
    console.log(dataToSave);
    localStorage.setItem(`tableData-${number}`, JSON.stringify(dataToSave));
    alert("Data saved successfully!");
  };

  // Submit Function (Sends data to backend)
  const handleSubmit = async () => {
    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableData, customText, email, transcriptNumber: number }),
      });

      if (response.ok) {
        alert("Data submitted successfully!");
      } else {
        alert("Failed to submit data.");
      }
    } catch (error) {
      console.error("Submission error:", error);
      alert("An error occurred while submitting.");
    }
  };

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const res = await fetch(`/t${number}/content.json`);
        if (!res.ok) throw new Error("Failed to fetch content.json");
        const data = await res.json();
        setGradeLevel(data.gradeLevel);
      } catch (err) {
        console.error("Error loading grade level:", err);
      }
    };

    const fetchSpeakers = async () => {
      try {
        const res = await fetch(`/t${number}/speakers.json`);
        if (!res.ok) throw new Error("Failed to fetch speakers.json");
        const data = await res.json();
        setSpeakerColors(data);
      } catch (err) {
        console.error("Error loading speakers:", err);
      }
    };
  
    const loadCSVData = async () => {
      try {
        const response = await fetch(`/t${number}/transcript.csv`);
        if (!response.ok) throw new Error("Failed to fetch the CSV file.");
        const text = await response.text();
  
        console.log("Loaded CSV content: ", text.substring(0, 500));
  
        Papa.parse(text, {
          complete: (result) => {
            console.log("CSV Data Loaded: ", result);
            if (result.errors.length) {
              setError("Error in CSV parsing: " + result.errors.map((err) => err.message).join(", "));
              setLoading(false);
              return;
            }
  
            // Add the type assertion here
            const updatedData = (result.data as CsvRow[]).map((row, index) => ({
            col1: row["#"] || `Row ${index + 1} Col 1`,
            col2: row["In cue"] || `Row ${index + 1} Col 2`,
            col3: row["Out cue"] || `Row ${index + 1} Col 3`,
            col4: row["Speaker"] || `Row ${index + 1} Col 4`,
            col5: row["Dialogue"] || `Row ${index + 1} Col 5`,
            checked: false,
            col6: "",
            }));
            setTableData(updatedData);
            setLoading(false);
          },
          header: true,
          skipEmptyLines: true,
        });
      } catch (error) {
        if (error instanceof Error) {
          setError("Error loading CSV: " + error.message);
        } else {
          setError("An unknown error occurred.");
        }
        setLoading(false);
      }
    };
  
    // Check localStorage first
    const savedData = localStorage.getItem(`tableData-${number}`);
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      setTableData(parsedData.tableData || []);
      setCustomText(parsedData.customText || "");
      setEmail(parsedData.email || "");
      setLoading(false);
    } else {
      loadCSVData(); // Load CSV if no saved data
    }
    fetchSpeakers();
    fetchContent(); // Fetch grade level text
  }, [number]);  
  
  const getRowColor = (speaker: string, speakerColors: { [key: string]: string }) => {
    return speakerColors[speaker] || "bg-gray-100"; // Default to gray if speaker is not found
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-white font-merriweather text-sm">
      {/* Grade Level and Prompt in a rounded box */}
      <div className="h-10"></div> 
      {/* First Box: Prompt */}
      <div className="w-full max-w-4xl p-6 mb-6 bg-gray-100 border rounded-lg shadow-md">
      <h1 className="text-3xl font-semibold text-gray-800 mb-4 text-left">
        Prompt: What do you notice about students&apos; mathematical strategies, (b) mathematical ideas, or (c) mathematical confusion with respect to this activity&apos;s purpose?
      </h1>
      </div>
      {/* Second Box: Grade Level */}
      <div className="w-full max-w-4xl p-6 mb-6 bg-gray-100 border rounded-lg h-auto">
        <h1 className="text-2xl text-gray-800 mb-4 text-left">{gradeLevel}</h1>
      </div>
      <h1 className="text-2xl font-semibold text-gray-800 mb-4 test-center">Lesson Purpose</h1>

      {/* Tab Buttons */}
      <div className="flex space-x-4 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)} // Open modal on click
            className={`px-4 py-2 font-semibold text-lg rounded-md text-black ${
              activeTab === tab.key ? "bg-blue-500" : "bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Render Modal for the Active Tab */}
      {tabs.map((tab) => (
        <Modal key={tab.key} isOpen={activeTab === tab.key} onClose={() => setActiveTab(null)}>
          {tab.content}
        </Modal>
      ))}

      {/* Title Above Table */}
      <h2 className="text-2xl font-semibold text-gray-800 mb-4 test-center">Full Lesson Transcript</h2>

      {loading ? (
        <div className="text-center py-4">Loading transcript data...</div>
      ) : error ? (
        <div className="text-center py-4 text-red-500">{error}</div>
      ) : (
        /* 3x5 Table with Editable Last Column */
        <div className="w-full max-w-4xl overflow-x-auto overflow-y-auto max-h-[500px] border">
          <table className="min-w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 border text-black">Line #</th>
                <th className="px-4 py-2 border text-black">Start Timestamp</th>
                <th className="px-4 py-2 border text-black">End Timestamp</th>
                <th className="px-4 py-2 border text-black">Speaker</th>
                <th className="px-4 py-2 border text-black w-[500px]">Utterance</th>
                <th className="px-4 py-2 border text-black">Noticeable Instance?</th> 
                <th className="px-4 py-2 border text-black">Explain</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((rowData, index) => {
                const disabled = isCheckboxDisabled(rowData.col4);
                return (
                  <tr
                    key={index}
                    className={`${getRowColor(rowData.col4, speakerColors)} ${rowData.checked ? "font-bold" : ""}`}
                  >
                    <td className="px-4 py-2 border text-black">{rowData.col1}</td>
                    <td className="px-4 py-2 border text-black">{rowData.col2}</td>
                    <td className="px-4 py-2 border text-black">{rowData.col3}</td>
                    <td className="px-4 py-2 border text-black">{rowData.col4}</td>
                    <td className="px-4 py-2 border text-black">{rowData.col5}</td>
                    <td className="px-4 py-2 border text-center">
                      <input
                        type="checkbox"
                        checked={rowData.checked}
                        onChange={() => handleCheckboxChange(index)}
                        disabled={disabled}
                        className={`w-5 h-5 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      />
                    </td>
                    <td className="px-4 py-2 border text-black w-[1000px] h-full">
                      <textarea
                        value={rowData.col6}
                        onChange={(e) => handleInputChange(index, e.target.value)}
                        rows={3}
                        className="w-full p-2 border rounded resize-none"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="h-5"></div> 
      {/* User Custom Text Field */}
      <div className="w-full max-w-4xl mb-4 text-black">
        <textarea
          className="w-full h-32 min-h-[150px] p-2 border rounded resize-y"
          placeholder="Enter any high-level comments here..."
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
        />
      </div>

      <div className="h-5"></div> 
      {/* User Email Field */}
      <div className="w-full max-w-xs mb-4 text-left">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Enter your email:
        </label>
        <input
          type="email"
          id="email"
          name="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 p-2 w-full border rounded-md text-black"
        />
      </div>

      {/* Buttons Container */}
      <div className="w-full max-w-4xl flex justify-center mt-4 space-x-20">
        <button 
          onClick={handleSave} 
          className="px-6 py-2 bg-gray-500 text-white font-semibold rounded-md hover:bg-gray-700 transition"
        >
          Save
        </button>
        
        <button 
          onClick={handleSubmit} 
          className="px-6 py-2 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-700 transition"
        >
          Submit
        </button>
      </div>
      <div className="h-10"></div> 
    </div>
  );
}