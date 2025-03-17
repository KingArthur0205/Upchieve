"use client";

// import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Modal from "./components/Modal";
import Tab1 from "./tabs/tab1";
import Tab2 from "./tabs/tab2";
import Tab3 from "./tabs/tab3";
import Papa from "papaparse";

export default function TabComponent() {
  // Tabs definition
  const [customText, setCustomText] = useState("");
  const [activeTab, setActiveTab] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState(true); // Loading state to track if the file is being fetched
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState<string | null>(null); // To store error message if any
  const [email, setEmail] = useState<string>("");

  const tabs = [
    { label: "Lesson Description", key: "tab1", content: <Tab1 /> },
    { label: "Learning Goals", key: "tab2", content: <Tab2 /> },
    { label: "Common Core State Standards", key: "tab3", content: <Tab3 /> },
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

    // Handle checkbox state changes
    const handleCheckboxChange = (index: number) => {
      const updatedData = [...tableData];
      updatedData[index].checked = !updatedData[index].checked;
      setTableData(updatedData);
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
    localStorage.setItem("tableData", JSON.stringify(dataToSave));
    alert("Data saved successfully!");
  };

  // Submit Function (Sends data to backend)
  const handleSubmit = async () => {
    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableData, customText, email }),
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

  // Load CSV data and update table
  useEffect(() => {
    // Check if there's saved data in localStorage
    const savedData = localStorage.getItem("tableData");
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      setTableData(parsedData.tableData || []);
      setCustomText(parsedData.customText || "");
      setEmail(parsedData.email);
      setLoading(false); // Finished loading from localStorage
    } else {
      // Load CSV data if no saved data in localStorage
      const loadCSVData = async () => {
        try {
          const response = await fetch("/t19/transcript19_b.csv"); // Correct file path
          if (!response.ok) {
            throw new Error("Failed to fetch the CSV file.");
          }
          const text = await response.text();
          console.log("Loaded CSV content: ", text.substring(0, 500)); // Log the first 500 characters of the file
  
          Papa.parse(text, {
            complete: (result) => {
              console.log("CSV Data Loaded: ", result);
              if (result.errors.length) {
                setError("Error in CSV parsing: " + result.errors.map((err) => err.message).join(", "));
                setLoading(false);
                return;
              }
  
              // Process data from CSV
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const updatedData = result.data.map((row: any, index: number) => ({
                col1: row["#"] || `Row ${index + 1} Col 1`,
                col2: row["In cue"] || `Row ${index + 1} Col 2`,
                col3: row["Out cue"] || `Row ${index + 1} Col 3`,
                col4: row["Speaker"] || `Row ${index + 1} Col 4`,
                col5: row["Dialogue"] || `Row ${index + 1} Col 5`,
                checked: false,
                col6: "", // Editable field for user input
              }));
              setTableData(updatedData);
              setLoading(false); // Finished loading from CSV
            },
            header: true, // Enable header to use column names
            skipEmptyLines: true, // Skip empty lines in the CSV file
          });
        } catch (error: unknown) {
          // Type assertion to assume error is of type Error
          if (error instanceof Error) {
            setError("Error loading CSV: " + error.message);
          } else {
            // Handle non-Error objects (optional)
            setError("An unknown error occurred.");
          }
          setLoading(false);
        }
      };
  
      loadCSVData(); // Trigger CSV data loading
    }
  }, []);
  

  const getRowColor = (speaker: string) => {
    switch (speaker) {
      case "Teacher E":
        return "bg-blue-200"; // Light Blue
      case "Student E1":
        return "bg-green-200"; // Light Green
      case "Student E3":
        return "bg-yellow-200"; // Light Yellow
      case "Student 3":
        return "bg-pink-200"; // Light Pink
      default:
        return "bg-gray-100"; // Default Gray for unknown speakers
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-white font-merriweather text-sm">
      {/* Grade Level and Prompt in a rounded box */}
      <div className="h-10"></div> 
      {/* First Box: Prompt */}
      <div className="w-full max-w-4xl p-6 mb-6 bg-gray-100 border rounded-lg shadow-md">
        <h1 className="text-3xl font-semibold text-gray-800 mb-4 text-left">
          Prompt: What do you notice about students’ (a) mathematical strategies, (b) mathematical ideas, or (c) mathematical confusion with respect to this activity’s purpose?
        </h1>
      </div>
      {/* Second Box: Grade Level */}
      <div className="w-full max-w-4xl p-6 mb-6 bg-gray-100 border rounded-lg">
        <h1 className="text-2xl text-gray-800 mb-4 text-left">
          Grade level: 8, Unit 5: Functions and Volume, Lesson 2: Introduction to Functions
        </h1>
      </div>
      <h1 className="text-2xl font-semibold text-gray-800 mb-4 test-center">Meta-data about the lesson</h1>

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

      {/* User Custom Text Field */}
      <div className="w-full max-w-4xl mb-4 text-black">
        <textarea
          className="w-full h-32 min-h-[150px] p-2 border rounded resize-y"
          placeholder="Enter any high-level comments here..."
          value={customText} // Bind state
          onChange={(e) => setCustomText(e.target.value)} // Update state
        />
      </div>

      {/* Title Above Table */}
      <h2 className="text-2xl font-semibold text-gray-800 mb-4 test-center">Full Lesson Transcript</h2>

      {/* 3x5 Table with Editable Last Column */}
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
            <th className="px-4 py-2 border text-black">Your Notes</th>
          </tr>
          </thead>
          <tbody>
            {tableData.map((rowData, index) => (
              <tr
                key={index}
                className={`${getRowColor(rowData.col4)} ${rowData.checked ? "font-bold" : ""}`}
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
                    className="w-5 h-5"
                  />
                </td>
                <td className="px-4 py-2 border text-black w-[1000px] h-full">
                  <textarea
                    value={rowData.col6}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    rows={3} // Adjust height
                    className="w-full p-2 border rounded resize-none"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
          value={email}  // Bind state to input value
          onChange={(e) => setEmail(e.target.value)}  // Update state on change
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
