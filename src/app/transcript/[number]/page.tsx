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

// Interface for a single note
interface Note {
  id: number;      // Numeric ID for the note
  title: string;   // User-editable title
  content: string;
  rowIndices: number[]; // Track which rows this note belongs to
}

// Updated table row interface
interface TableRow {
  col1: string;
  col2: string;
  col3: string;
  col4: string;
  col5: string;
  col6: string;
  noteIds: string; // This will store the comma-separated note IDs (read-only)
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
  
  // Store notes separately from table data
  const [notes, setNotes] = useState<Note[]>([]);
  const [nextNoteId, setNextNoteId] = useState(1);
  // Add this with your other state declarations
  const [availableIds, setAvailableIds] = useState<number[]>([]);
  
  // State for new note creation
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  
  // Track which note title is currently being edited
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  
  // NEW: Track which note lines are being edited
  const [editingLinesId, setEditingLinesId] = useState<number | null>(null);
  const [tempSelectedRows, setTempSelectedRows] = useState<number[]>([]);
  
  const tabs = [
    { label: "Learning Goals", key: "tab2", content: <Tab2 number={number}/> },
    { label: "Common Core State Standards", key: "tab3", content: <Tab3 number={number}/> },
  ];

  // Updated table state
  const [tableData, setTableData] = useState<TableRow[]>(
    Array.from({ length: 3 }, (_, index) => ({
      col1: `Row ${index + 1} Col 1`,
      col2: `Row ${index + 1} Col 2`,
      col3: `Row ${index + 1} Col 3`,
      col4: `Row ${index + 1} Col 4`,
      col5: `Row ${index + 1} Col 5`,
      col6: `Row ${index + 1} Col 6`,
      noteIds: "", // Comma-separated note IDs (read-only)
    }))
  );

  // After your state declarations
  const isRowSelectable = (speaker: string): boolean => {
    return speaker.includes("Student");
  };

  // Function to parse note IDs from a comma-separated string
  const parseNoteIds = (idString: string): number[] => {
    return idString
      .split(',')
      .map(id => id.trim())
      .filter(id => id !== "")
      .map(id => parseInt(id, 10))
      .filter(id => !isNaN(id));
  };

  // Toggle selection of a row
  const toggleRowSelection = (rowIndex: number) => {
    const speaker = tableData[rowIndex]?.col5 || "";
    
    // Skip if this is a non-selectable row
    if (!isRowSelectable(speaker)) {
      return;
    }
    
    if (selectedRows.includes(rowIndex)) {
      setSelectedRows(selectedRows.filter(index => index !== rowIndex));
    } else {
      setSelectedRows([...selectedRows, rowIndex]);
    }
  };

  // Toggle selection of a row for line number editing
  const toggleTempRowSelection = (rowIndex: number) => {
    const speaker = tableData[rowIndex]?.col5 || "";
    
    // Skip if this is a non-selectable row
    if (!isRowSelectable(speaker)) {
      return;
    }
    
    if (tempSelectedRows.includes(rowIndex)) {
      setTempSelectedRows(tempSelectedRows.filter(index => index !== rowIndex));
    } else {
      setTempSelectedRows([...tempSelectedRows, rowIndex]);
    }
  };

  // Start the note creation process
  const startNoteCreation = () => {
    setIsCreatingNote(true);
    setSelectedRows([]);
  };
  
  // Cancel note creation
  const cancelNoteCreation = () => {
    setIsCreatingNote(false);
    setSelectedRows([]);
  };

  // Function to create a new note
  const handleCreateNote = () => {
    if (selectedRows.length === 0) return;
    
    // Use an available ID if one exists, otherwise use nextNoteId
    let noteId: number;
    if (availableIds.length > 0) {
      // Get the first available ID
      noteId = availableIds[0];
      // Remove this ID from the available list
      setAvailableIds(availableIds.slice(1));
    } else {
      // No available IDs, use the next sequential ID
      noteId = nextNoteId;
      setNextNoteId(noteId + 1);
    }
    
    // Create new note
    const updatedNotes = [...notes, {
      id: noteId,
      title: noteId.toString(),
      content: "",
      rowIndices: [...selectedRows]
    }];
    
    // Update table data note IDs
    const updatedTableData = [...tableData];
    selectedRows.forEach(rowIndex => {
      const currentIds = parseNoteIds(updatedTableData[rowIndex].noteIds);
      if (!currentIds.includes(noteId)) {
        const newIds = [...currentIds, noteId];
        updatedTableData[rowIndex].noteIds = newIds.join(', ');
      }
    });
    
    setTableData(updatedTableData);
    setNotes(updatedNotes);
    setSelectedRows([]);
    setIsCreatingNote(false);
  };

  // Handle note content changes
  const handleNoteContentChange = (noteId: number, value: string) => {
    const updatedNotes = [...notes];
    const noteIndex = updatedNotes.findIndex(note => note.id === noteId);
    
    if (noteIndex !== -1) {
      updatedNotes[noteIndex].content = value;
      setNotes(updatedNotes);
    }
  };

  // Functions for title editing

  // Start editing a title
  const startTitleEdit = (noteId: number) => {
    setEditingTitleId(noteId);
  };

  // Update title text as user types
  const updateTitleText = (noteId: number, newTitle: string) => {
    const updatedNotes = [...notes];
    const noteIndex = updatedNotes.findIndex(note => note.id === noteId);
    
    if (noteIndex !== -1) {
      updatedNotes[noteIndex].title = newTitle;
      setNotes(updatedNotes);
    }
  };

  // Save title edit - if empty, use "no title"
  const saveTitleEdit = (noteId: number) => {
    const updatedNotes = [...notes];
    const noteIndex = updatedNotes.findIndex(note => note.id === noteId);
    
    if (noteIndex !== -1) {
      // Use "no title" if the input is empty
      if (updatedNotes[noteIndex].title.trim() === "") {
        updatedNotes[noteIndex].title = "no title";
      }
      setNotes(updatedNotes);
    }
    
    // Exit edit mode
    setEditingTitleId(null);
  };

  // Cancel editing without saving changes
  const cancelTitleEdit = (noteId: number) => {
    const originalNote = notes.find(note => note.id === noteId);
    if (originalNote && originalNote.title.trim() === "") {
      // If they were editing a blank title, restore "no title"
      const updatedNotes = [...notes];
      const noteIndex = updatedNotes.findIndex(note => note.id === noteId);
      if (noteIndex !== -1) {
        updatedNotes[noteIndex].title = "no title";
        setNotes(updatedNotes);
      }
    }
    setEditingTitleId(null);
  };

  // NEW: Functions for line number editing
  
  // Start editing line numbers
  const startLinesEdit = (noteId: number) => {
    const note = notes.find(note => note.id === noteId);
    if (note) {
      setTempSelectedRows([...note.rowIndices]);
      setEditingLinesId(noteId);
    }
  };
  
  // Save line number edits
  const saveLinesEdit = (noteId: number) => {
    // Find the note to update
    const updatedNotes = [...notes];
    const noteIndex = updatedNotes.findIndex(note => note.id === noteId);
    
    if (noteIndex === -1) {
      setEditingLinesId(null);
      return;
    }
    
    const oldRowIndices = updatedNotes[noteIndex].rowIndices;
    const newRowIndices = [...tempSelectedRows];
    
    // Update the note's row indices
    updatedNotes[noteIndex].rowIndices = newRowIndices;
    
    // Update table data
    const updatedTableData = [...tableData];
    
    // Remove note ID from rows that were removed
    oldRowIndices.forEach(rowIndex => {
      if (!newRowIndices.includes(rowIndex)) {
        const currentIds = parseNoteIds(updatedTableData[rowIndex].noteIds);
        const updatedIds = currentIds.filter(id => id !== noteId);
        updatedTableData[rowIndex].noteIds = updatedIds.join(', ');
      }
    });
    
    // Add note ID to rows that were added
    newRowIndices.forEach(rowIndex => {
      const currentIds = parseNoteIds(updatedTableData[rowIndex].noteIds);
      if (!currentIds.includes(noteId)) {
        const newIds = [...currentIds, noteId];
        updatedTableData[rowIndex].noteIds = newIds.join(', ');
      }
    });
    
    setTableData(updatedTableData);
    setNotes(updatedNotes);
    setEditingLinesId(null);
    setTempSelectedRows([]);
  };
  
  // Cancel line number editing
  const cancelLinesEdit = () => {
    setEditingLinesId(null);
    setTempSelectedRows([]);
  };

  // Delete a note from the analysis panel
  const handleDeleteNote = (noteId: number) => {
    // Find the note to delete
    const noteToDelete = notes.find(note => note.id === noteId);
    if (!noteToDelete) return;
    
    // Remove ID from all associated rows
    const updatedData = [...tableData];
    noteToDelete.rowIndices.forEach(rowIndex => {
      const currentIds = parseNoteIds(updatedData[rowIndex].noteIds);
      const updatedIds = currentIds.filter(id => id !== noteId);
      updatedData[rowIndex].noteIds = updatedIds.join(', ');
    });
    
    // Remove note from notes collection
    const updatedNotes = notes.filter(note => note.id !== noteId);
    
    // Add this ID to the available list
    setAvailableIds([...availableIds, noteId]);
    
    setTableData(updatedData);
    setNotes(updatedNotes);
  };

  // Save Function (Stores data locally)
  const handleSave = () => {
    const dataToSave = { tableData, notes, customText, email, nextNoteId, availableIds };
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
        body: JSON.stringify({ tableData, notes, customText, email, transcriptNumber: number }),
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

  // Get note title by ID for display in the table
  const getNoteDisplayById = (noteId: number): string => {
    const note = notes.find(note => note.id === noteId);
    return note ? note.id.toString() : "";
  };

  // Function to get display titles for the table
  const getNoteDisplayText = (idsString: string): string => {
    if (!idsString.trim()) return "—";
    
    const ids = parseNoteIds(idsString);
    return ids.map(id => getNoteDisplayById(id)).join(', ');
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
            
            // Add the type assertion here with updated schema
            const updatedData = (result.data as CsvRow[]).map((row, index) => ({
              col1: row["Transcript"] || `Row ${index + 1} Col 1`,
              col2: row["#"] || `Row ${index + 1} Col 2`,
              col3: row["In cue"] || `Row ${index + 1} Col 3`,
              col4: row["Out cue"] || `Row ${index + 1} Col 4`,
              col5: row["Speaker"] || `Row ${index + 1} Col 5`,
              col6: row["Dialogue"] || `Row ${index + 1} Col 6`,
              noteIds: "",
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
      try {
        const parsedData = JSON.parse(savedData);
        setAvailableIds(parsedData.availableIds || []);
        // Handle migration from old format to new format
        if (parsedData.tableData) {
          // Migrate old noteTitle format to new noteIds format
          if (parsedData.tableData[0]?.noteTitle !== undefined && parsedData.tableData[0]?.noteIds === undefined) {
            // Create a mapping of old titles to new IDs
            const titleToIdMap = new Map<string, number>();
            let highestId = 0;
            
            const migratedNotes: Note[] = [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            parsedData.tableData.forEach((row: any, rowIndex: number) => {
              const oldTitles = row.noteTitle ? row.noteTitle.split(',').map((t: string) => t.trim()).filter((t: string) => t !== "") : [];
              
              oldTitles.forEach((oldTitle: string) => {
                if (!titleToIdMap.has(oldTitle)) {
                  // Create a new ID for this title
                  const newId = highestId + 1;
                  highestId = newId;
                  titleToIdMap.set(oldTitle, newId);
                  
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const oldNote = parsedData.notes?.find((n: any) => n.title === oldTitle);
                  
                  migratedNotes.push({
                    id: newId,
                    title: oldTitle,
                    content: oldNote?.content || "",
                    rowIndices: [rowIndex]
                  });
                } else {
                  // Add this row to the existing note
                  const existingNoteId = titleToIdMap.get(oldTitle);
                  const existingNote = migratedNotes.find(n => n.id === existingNoteId);
                  if (existingNote && !existingNote.rowIndices.includes(rowIndex)) {
                    existingNote.rowIndices.push(rowIndex);
                  }
                }
              });
            });
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const migratedTableData = parsedData.tableData.map((row: any) => {
              const oldTitles = row.noteTitle ? row.noteTitle.split(',').map((t: string) => t.trim()).filter((t: string) => t !== "") : [];
              const newIds = oldTitles.map((title: string) => titleToIdMap.get(title)).filter(Boolean);
              
              return {
                ...row,
                noteIds: newIds.join(', '),
              };
            });
            
            setTableData(migratedTableData);
            setNotes(migratedNotes);
            setNextNoteId(highestId + 1);
          } else {
            // If data is already in the new format
            setTableData(parsedData.tableData);
            setNotes(parsedData.notes || []);
            setNextNoteId(parsedData.nextNoteId || Math.max(...parsedData.notes.map((n: Note) => n.id), 0) + 1);
          }
          
          setCustomText(parsedData.customText || "");
          setEmail(parsedData.email || "");
          setLoading(false);
        } else {
          loadCSVData(); // Load CSV if saved data format is incorrect
        }
      } catch (error) {
        console.error("Error parsing saved data:", error);
        loadCSVData();
      }
    } else {
      loadCSVData(); // Load CSV if no saved data
    }
    fetchSpeakers();
    fetchContent(); // Fetch grade level text
  }, [number]); 
  
  const getRowColor = (speaker: string, speakerColors: { [key: string]: string }) => {
    return speakerColors[speaker] || "bg-gray-100"; // Default to gray if speaker is not found
  };

  // Generate rows for a specific note
  const generateNoteRows = (note: Note) => {
    return note.rowIndices.map(rowIndex => {
      if (rowIndex >= 0 && rowIndex < tableData.length) {
        return tableData[rowIndex];
      }
      return null;
    }).filter((row): row is TableRow => row !== null);
  };

  return (
    <div className="flex flex-col items-center min-h-screen w-full bg-white font-merriweather text-sm">
      {/* Header area with title and tabs */}
      <div className="w-full max-w-6xl p-4 mb-4">
        <h1 className="text-3xl font-semibold text-gray-800 mb-4 text-center">
        {`Prompt: What do you notice about students' (a) mathematical strategies, (b) mathematical ideas, or (c) mathematical confusion with respect to this activity's purpose?`}
        </h1>
        
        <div className="bg-gray-100 border rounded-lg p-4 mb-4">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {"Why might educators & researchers care about LLMs' noticing students' math talk?"}
          </h2>
          <h2 className="text-xl font-semibold text-gray-800 mb-2 italic">
            {"To know how to move students' thinking forward"}
          </h2>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {"Value proposition:"}
          </h2>
          <ul className="list-disc list-inside text-gray-700">
            <li>{"It helps plan next lessons."}</li>
            <li>{"It helps decide how to respond in the moment (e.g., facilitating student group discussions, responding to students' confusion, and or questions)."}</li>
            <li>{"It provides reflection opportunities for teacher professional development."}</li>
          </ul>
        </div>

        <div className="bg-gray-100 border rounded-lg p-4 mb-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">{gradeLevel}</h2>
        </div>

        {/* Tab Buttons */}
        <div className="flex justify-center space-x-4 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 font-semibold text-lg rounded-md text-black ${
                activeTab === tab.key ? "bg-blue-500 text-white" : "bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Render Modal for the Active Tab */}
      {tabs.map((tab) => (
        <Modal key={tab.key} isOpen={activeTab === tab.key} onClose={() => setActiveTab(null)}>
          {tab.content}
        </Modal>
      ))}

      {/* Main 3-panel layout */}
      <div className="flex w-full max-w-8xl h-[calc(100vh-200px)] mb-4">
        {/* Left Panel - Prompt and Grade Level */}
        <div className="w-2/5 p-4 flex flex-col overflow-y-auto border-r border-gray-300">
          <div className="bg-gray-100 border rounded-lg shadow-md p-4 mb-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Student-facing Lesson Prompts</h2>
            <Tab1 number={number} />
          </div>
        </div>
        
        {/* Center Panel - Transcript Table */}
        <div className="w-2/5 p-4 flex flex-col border-r border-gray-300">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-semibold text-gray-800 text-center">Full Lesson Transcript</h2>
            
            {/* Note creation controls */}
            {isCreatingNote ? (
              <div className="flex items-center">
                <span className="mr-2 text-sm text-black italic">Select  <b className="font-bold">ALL</b>  relevant rows.</span>
                <button
                  onClick={handleCreateNote}
                  disabled={selectedRows.length === 0}
                  className={`px-2 py-1 rounded text-xs mr-1 ${
                    selectedRows.length === 0
                      ? "bg-gray-300 text-gray-500"
                      : "bg-green-500 text-white"
                  }`}
                >
                  Create
                </button>
                <button
                  onClick={cancelNoteCreation}
                  className="px-2 py-1 rounded text-xs bg-red-500 text-white"
                >
                  Cancel
                </button>
              </div>
            ) : editingLinesId !== null ? (
              <div className="flex items-center">
                <span className="mr-2 text-sm">Editing lines for note #{editingLinesId}</span>
                <button
                  onClick={() => saveLinesEdit(editingLinesId)}
                  className="px-2 py-1 rounded text-xs mr-1 bg-green-500 text-white"
                >
                  Save
                </button>
                <button
                  onClick={cancelLinesEdit}
                  className="px-2 py-1 rounded text-xs bg-red-500 text-white"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={startNoteCreation}
                className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                + New Note
              </button>
            )}
          </div>
          
          {loading ? (
            <div className="text-center py-4 flex-grow">Loading transcript data...</div>
          ) : error ? (
            <div className="text-center py-4 text-red-500 flex-grow">{error}</div>
          ) : (
            <div className="overflow-y-auto flex-grow border">
              <table className="min-w-full table-auto border-collapse">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="bg-gray-100">
                    {(isCreatingNote || editingLinesId !== null) && (
                      <th className="px-2 py-2 border text-black text-sm">Select</th>
                    )}
                    <th className="px-2 py-2 border text-black text-sm">Lesson Segment ID</th>
                    <th className="px-2 py-2 border text-black text-sm">Line #</th>
                    <th className="px-2 py-2 border text-black text-sm">Start</th>
                    <th className="px-2 py-2 border text-black text-sm">End</th>
                    <th className="px-2 py-2 border text-black text-sm">Speaker</th>
                    <th className="px-2 py-2 border text-black text-sm">Utterance</th>
                    <th className="px-2 py-2 border text-black text-sm">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((rowData, index) => {
                    const hasNote = rowData.noteIds.trim() !== "";
                    const isSelectedForEditing = editingLinesId !== null && tempSelectedRows.includes(index);
                    
                    return (
                      <tr
                        key={index}
                        className={`${getRowColor(rowData.col5, speakerColors)} 
                          ${hasNote ? "font-bold" : ""} 
                          ${isSelectedForEditing ? "ring-2 ring-blue-500" : ""}
                          ${!isRowSelectable(rowData.col5) ? "opacity-75" : ""}`}
                      >
                        {(isCreatingNote || editingLinesId !== null) && (
                          <td className="px-2 py-2 border text-black text-sm text-center">
                            <input
                              type="checkbox"
                              checked={isCreatingNote ? selectedRows.includes(index) : tempSelectedRows.includes(index)}
                              onChange={() => isCreatingNote ? toggleRowSelection(index) : toggleTempRowSelection(index)}
                              disabled={!isRowSelectable(rowData.col5)}
                              title={!isRowSelectable(rowData.col5) ? "Teacher and Unknown speakers cannot be selected" : ""}
                              className="w-4 h-4"
                            />
                          </td>
                        )}
                        <td className="px-2 py-2 border text-black text-sm">{rowData.col1}</td>
                        <td className="px-2 py-2 border text-black text-sm">{rowData.col2}</td>
                        <td className="px-2 py-2 border text-black text-sm">{rowData.col3}</td>
                        <td className="px-2 py-2 border text-black text-sm">{rowData.col4}</td>
                        <td className="px-2 py-2 border text-black text-sm">{rowData.col5}</td>
                        <td className="px-2 py-2 border text-black text-sm">{rowData.col6}</td>
                        <td className="px-2 py-2 border text-black text-sm">
                          {getNoteDisplayText(rowData.noteIds)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Right Panel - Analysis Notes */}
        <div className="w-1/5 p-4 flex flex-col overflow-y-auto">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">Notes</h2>
          
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : (
            <div className="flex-grow overflow-y-auto">
              {notes.map((note) => {
                const noteRows = generateNoteRows(note);
                const isEditingTitle = editingTitleId === note.id;
                
                return (
                  <div key={note.id} className="mb-4 border p-3 rounded bg-white shadow-sm">
                    <div className="flex justify-between mb-1">
                      <div className="flex items-center">
                        <span className="font-semibold text-sm text-blue-600 mr-2">#{note.id}</span>
                        
                        {isEditingTitle ? (
                          <div className="flex items-center w-full">
                            <input
                              type="text"
                              value={note.title}
                              onChange={(e) => updateTitleText(note.id, e.target.value)}
                              className="text-sm border border-blue-300 focus:border-blue-500 focus:outline-none bg-white p-1 rounded w-full text-black"
                              autoFocus
                            />
                            <button
                              onClick={() => saveTitleEdit(note.id)}
                              className="ml-1 text-green-500 hover:text-green-700 text-xs p-1"
                              title="Save title"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => cancelTitleEdit(note.id)}
                              className="ml-1 text-red-500 hover:text-red-700 text-xs p-1"
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center w-full">
                            <span className="text-sm text-black mr-2">
                              {note.title || "no title"}
                            </span>
                            <button
                              onClick={() => startTitleEdit(note.id)}
                              className="ml-1 text-blue-500 hover:text-blue-700 text-xs"
                              title="Edit title"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="ml-2 text-red-500 hover:text-red-700 text-xs"
                              title="Delete note"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <span className="text-gray-600 text-xs">
                      Lines: {note.rowIndices.map(idx => tableData[idx]?.col2).join(', ')}
                    </span>
                    
                    <button
                      onClick={() => startLinesEdit(note.id)}
                      className="ml-2 text-blue-500 hover:text-blue-700 text-xs"
                      title="Edit line numbers"
                    >
                      ✎ Edit
                    </button>

                    {/* Display each row's content for this note */}
                    <div className="max-h-40 overflow-y-auto mb-2 mt-1">
                      {noteRows.map((row, rowIdx) => (
                        <div key={rowIdx} className="mb-1 pb-1 border-b border-gray-100 last:border-b-0">
                          <p className="text-sm text-gray-800 italic">{row.col6}</p>
                          <p className="text-xs text-gray-500">Speaker: {row.col5}</p>
                        </div>
                      ))}
                    </div>
                    
                    <textarea
                      value={note.content}
                      onChange={(e) => handleNoteContentChange(note.id, e.target.value)}
                      rows={3}
                      className="w-full p-2 border rounded resize-none text-sm text-black"
                      placeholder="Your analysis..."
                    />
                  </div>
                );
              })}
              
              {notes.length === 0 && (
                <div className="text-center py-4 text-gray-500 italic">
                  {'No notes yet. Click "New Note" to begin.'}
                </div>
              )}
            </div>
          )}
          
          {/* High level comments field */}
          <div className="mt-4">
            <h3 className="font-semibold text-gray-800 mb-2 text-sm">Overall Comments about the Lesson</h3>
            <textarea
              className="w-full h-32 p-2 border rounded resize-y text-sm text-black"
              placeholder="Enter any high-level comments here..."
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
            />
          </div>
        </div>
      </div>
      
      {/* Footer area with email and buttons */}
      <div className="w-full max-w-6xl p-4 flex flex-col items-center">
        <div className="w-full max-w-xs mb-4">
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
        
        <div className="flex justify-center space-x-8">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-700 transition"
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
      </div>
    </div>
  );
}