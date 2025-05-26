"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Tab1 from "../../tabs/tab1";
import Papa from "papaparse";
import AnnotationPanel, { AnnotationData, FeatureDetails } from "../../components/AnnotationPanel";
import { read, utils, writeFile } from "xlsx";
import FeaturePopup from "../../components/FeaturePopup";
import React from "react";
import { debounce } from "lodash";

interface CsvRow {
  "#": string;
  "In cue": string;
  "Out cue": string;
  "Speaker": string;
  "Dialogue": string;
  "selectable": string; 
  [key: string]: string; // For any other columns that might exist
}

// Interface for a single note
interface Note {
  content_1: string;
  content_2: string;
  id: number;      // Numeric ID for the note
  title: string;   // User-editable title
  rowIndices: number[]; // Track which rows this note belongs to
}

// Updated table row interface
interface TableRow {
  col1: string;
  col2: number;
  col3: string;
  col4: string;
  col5: string;
  col6: string;
  col7: string; // Selectable field
  noteIds: string; // This will store the comma-separated note IDs (read-only)
}

// Types for the feature columns component
interface FeatureColumnsProps {
  rowData: TableRow;
  selectedFeature: string | null;
  annotationData: AnnotationData | null;
  isStudent: boolean;
  onFeatureChange: (lineNumber: number, code: string, value: boolean) => void;
}

export default function TranscriptPage() {
  const params = useParams();
  const number = params.number as string;
  const [customText, setCustomText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [activityPurpose, setActivityPurpose] = useState("");
  const [speakerColors, setSpeakerColors] = useState<{ [key: string]: string }>({});
  const [availableSegment, setAvailableSegment] = useState<string []>([]);
  const [whichSegment, setWhichSegment] = useState<string>("full_transcript");
  const [showPromptPanel, setShowPromptPanel] = useState(true);
  const [columnVisibility, setColumnVisibility] = useState({
    lessonSegmentId: true,
    lineNumber: true,
    start: false,
    end: false,
    speaker: true,
    utterance: true,
    notes: true
  });

  // Add these state variables at the top of your component
  const [leftPanelWidth, setLeftPanelWidth] = useState("33.33%"); // Default 2/6
  const [centerPanelWidth, setcenterPanelWidth] = useState("50%"); // Default 3/6
  const [rightPanelWidth, setRightPanelWidth] = useState("16.67%"); // Default 1/6
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);

  // Add these handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLeft) {
        const newWidth = (e.clientX / window.innerWidth) * 100;
        // Set limits (min 15%, max 50%)
        const limitedWidth = Math.min(Math.max(newWidth, 15), 50);
        setLeftPanelWidth(`${limitedWidth}%`);
        
        // Recalculate center panel width
        const remainingWidth = 100 - limitedWidth - parseFloat(rightPanelWidth);
        setcenterPanelWidth(`${remainingWidth}%`);
      } else if (isDraggingRight) {
        const rightEdge = window.innerWidth;
        const newRightWidth = ((rightEdge - e.clientX) / rightEdge) * 100;
        // Set limits (min 10%, max 40%)
        const limitedWidth = Math.min(Math.max(newRightWidth, 10), 40);
        setRightPanelWidth(`${limitedWidth}%`);
        
        // Recalculate center panel width
        const remainingWidth = 100 - parseFloat(leftPanelWidth) - limitedWidth;
        setcenterPanelWidth(`${remainingWidth}%`);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
    };

    if (isDraggingLeft || isDraggingRight) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingLeft, isDraggingRight, leftPanelWidth, rightPanelWidth]);

  const toggleColumnVisibility = (columnKey: keyof typeof columnVisibility) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };
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

  // Updated table state
  const [tableData, setTableData] = useState<TableRow[]>(
    Array.from({ length: 3 }, (_, index) => ({
      col1: `Row ${index + 1} Col 1`,
      col2: 10,
      col3: `Row ${index + 1} Col 3`,
      col4: `Row ${index + 1} Col 4`,
      col5: `Row ${index + 1} Col 5`,
      col6: `Row ${index + 1} Col 6`,
      col7: `Row ${index + 1} Col 7`,
      noteIds: "", // Comma-separated note IDs (read-only)
    }))
  );

  // After your state declarations
  const isRowSelectable = (rowIndex: number): boolean => {
    // Assuming col2 should be a number, convert it from string if needed
    const rowItem = tableData.find(item => Number(item.col2) === rowIndex);

    if (rowItem) {
      // Check the 'selectable' column - convert to lowercase and check for "true"
      const selectableValue = rowItem.col7?.toLowerCase();
      return selectableValue === "true" || selectableValue === "yes" || selectableValue === "1";
    }
    return false;
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
  const toggleRowSelection = (col2Value: number) => {
    if (selectedRows.includes(col2Value)) {
      setSelectedRows(selectedRows.filter(id => id !== col2Value));
    } else {
      setSelectedRows([...selectedRows, col2Value]);
    }
  };

  // Toggle selection of a row for line number editing
  const toggleTempRowSelection = (col2Value: number) => {
    if (isRowSelectable(col2Value)) {
      if (tempSelectedRows.includes(col2Value)) {
        setTempSelectedRows(tempSelectedRows.filter(id => id !== col2Value));
      } else {
        setTempSelectedRows([...tempSelectedRows, col2Value]);
      }
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
      content_1: "",
      content_2: "",
      rowIndices: [...selectedRows]
    }];
    
    // Update table data note IDs
    const updatedTableData = tableData.map(row => ({
      ...row,
      noteIds: selectedRows.includes(row.col2) 
        ? [...parseNoteIds(row.noteIds), noteId].join(', ')
        : row.noteIds
    }));
    
    setTableData(updatedTableData);
    setNotes(updatedNotes);
    setSelectedRows([]);
    setIsCreatingNote(false);
  };

  // Handle note content changes
  const handleNoteContentChange1 = (noteId: number, value: string) => {
    const updatedNotes = [...notes];
    const noteIndex = updatedNotes.findIndex(note => note.id === noteId);
    
    if (noteIndex !== -1) {
      updatedNotes[noteIndex].content_1 = value;
      setNotes(updatedNotes);
    }
  };

  const handleNoteContentChange2 = (noteId: number, value: string) => {
    const updatedNotes = [...notes];
    const noteIndex = updatedNotes.findIndex(note => note.id === noteId);
    
    if (noteIndex !== -1) {
      updatedNotes[noteIndex].content_2 = value;
      setNotes(updatedNotes);
    }
  };

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

  const handleSegmentClick = (segment: string) => {
    setWhichSegment(segment);
  };

  // Function to get display titles for the table
  const getNoteDisplayText = (idsString: string, rowIndex: number): string => {
    const ids = parseNoteIds(idsString);
    return ids.length > 0 ? ids.map((id: number) => getNoteDisplayById(id)).join(', ') : "—";
  };

  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotationData, setAnnotationData] = useState<AnnotationData | null>(null);
  const [selectedAnnotationSheet, setSelectedAnnotationSheet] = useState<string | null>(null);
  const [showNotesColumn, setShowNotesColumn] = useState(true);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);

  const ALLOWED_SHEETS = ["Talk", "Conceptual", "Discursive", "Lexical"];

  // Function to save all annotations
  const saveAllAnnotations = (data: AnnotationData | null) => {
    if (!data) return;
    localStorage.setItem(`annotations-${number}`, JSON.stringify(data));
  };

  // Handle feature sheet selection
  const handleFeatureSelection = (feature: string) => {
    // Save current annotations before switching
    saveAllAnnotations(annotationData);

    // If clicking the same feature, deselect it
    if (feature === selectedFeature) {
      setSelectedFeature(null);
      return;
    }

    setSelectedFeature(feature);
  };

  // Simplified and optimized toggle component with enhanced contrast
  const FeatureToggle = React.memo(({ 
    isChecked, 
    isDisabled, 
    onToggle 
  }: { 
    isChecked: boolean;
    isDisabled: boolean;
    onToggle: (checked: boolean) => void;
  }) => (
    <div 
      className={`
        inline-flex rounded-md select-none
        ${isDisabled ? 'opacity-40' : ''}
      `}
    >
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => !isDisabled && onToggle(false)}
        className={`
          min-w-[28px] px-2 py-0.5 text-xs font-bold rounded-l-md border-r border-white/20
          ${isChecked 
            ? 'bg-gray-100 text-gray-400' 
            : 'bg-red-600 text-white shadow-sm'
          }
        `}
      >
        N
      </button>
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => !isDisabled && onToggle(true)}
        className={`
          min-w-[28px] px-2 py-0.5 text-xs font-bold rounded-r-md
          ${isChecked 
            ? 'bg-emerald-600 text-white shadow-sm' 
            : 'bg-gray-100 text-gray-400'
          }
        `}
      >
        Y
      </button>
    </div>
  ), (prev, next) => 
    prev.isChecked === next.isChecked && 
    prev.isDisabled === next.isDisabled
  );

  // Memoize the header cell to prevent re-renders
  const FeatureHeader = React.memo(({ 
    code, 
    definition,
    example1,
    nonexample1
  }: { 
    code: string;
    definition: string;
    example1: string;
    nonexample1: string;
  }) => (
    <th
      className="px-2 py-2 border border-black border-2 text-sm w-16 cursor-pointer group"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setSelectedFeaturePopup({
          code,
          definition,
          example1,
          nonexample1,
          position: {
            x: rect.left + rect.width / 2,
            y: rect.bottom + 10
          }
        });
      }}
    >
      <div className="
        text-sky-600 
        group-hover:text-sky-800
        group-hover:underline 
        group-hover:underline-offset-4
        transition-all
        font-medium
      ">
        {code}
      </div>
    </th>
  ));

  // Optimize feature columns component
  const FeatureColumns = React.memo(({ 
    rowData,
    selectedFeature,
    annotationData,
    isStudent,
    onFeatureChange
  }: FeatureColumnsProps) => {
    // Early return if no data
    if (!selectedFeature || !annotationData?.[selectedFeature]) return null;

    const rowAnnotations = annotationData[selectedFeature].annotations[rowData.col2 - 1] || {};
    const codes = annotationData[selectedFeature].codes;
    
    return (
      <>
        {codes.map((code: string) => (
          <td key={code} className="px-1 py-1 border border-black border-2 text-center">
            <FeatureToggle
              isChecked={!!rowAnnotations[code]}
              isDisabled={!isStudent}
              onToggle={(checked) => onFeatureChange(rowData.col2 - 1, code, checked)}
            />
          </td>
        ))}
      </>
    );
  }, (prev, next) => {
    // Simplified comparison focusing only on what matters
    if (prev.selectedFeature !== next.selectedFeature) return false;
    if (prev.isStudent !== next.isStudent) return false;
    if (!prev.selectedFeature || !next.selectedFeature) return true;

    const prevRow = prev.annotationData?.[prev.selectedFeature]?.annotations[prev.rowData.col2 - 1];
    const nextRow = next.annotationData?.[next.selectedFeature]?.annotations[next.rowData.col2 - 1];
    return prevRow === nextRow; // Direct reference comparison instead of JSON stringify
  });

  // Memoize the filtered table data
  const filteredTableData = React.useMemo(() => {
    return tableData.filter(rowData => 
      whichSegment === 'full_transcript' || rowData.col1 === whichSegment
    );
  }, [tableData, whichSegment]);

  // Memoize feature codes and definitions
  const featureInfo = React.useMemo(() => {
    if (!selectedFeature || !annotationData?.[selectedFeature]) return [];
    return annotationData[selectedFeature].codes.map(code => ({
      code,
      definition: annotationData[selectedFeature].definitions[code]?.Definition || ''
    }));
  }, [selectedFeature, annotationData]);

  // Optimize the debounced save to be less aggressive
  const debouncedSave = React.useCallback(
    debounce((data: AnnotationData) => {
      localStorage.setItem(`annotations-${number}`, JSON.stringify(data));
    }, 2000), // Increased debounce time to reduce storage operations
    [number]
  );

  // Update TableRow to use the new FeatureColumns component
  const TableRow = React.memo(({ 
    rowData, 
    selectedFeature, 
    annotationData,
    onFeatureChange,
    speakerColors,
    columnVisibility,
    showNotesColumn,
    isCreatingNote,
    editingLinesId,
    selectedRows,
    tempSelectedRows,
    toggleRowSelection,
    toggleTempRowSelection,
    getNoteDisplayText
  }: {
    rowData: TableRow;
    selectedFeature: string | null;
    annotationData: AnnotationData | null;
    onFeatureChange: (lineNumber: number, code: string, value: boolean) => void;
    speakerColors: { [key: string]: string };
    columnVisibility: any;
    showNotesColumn: boolean;
    isCreatingNote: boolean;
    editingLinesId: number | null;
    selectedRows: number[];
    tempSelectedRows: number[];
    toggleRowSelection: (col2Value: number) => void;
    toggleTempRowSelection: (col2Value: number) => void;
    getNoteDisplayText: (idsString: string, rowIndex: number) => string;
  }) => {
    const hasNote = rowData.noteIds.trim() !== "";
    const isSelectedForLineEdit = editingLinesId !== null && tempSelectedRows.includes(+rowData.col2);
    const isRowSelectableForNote = rowData.col7?.toLowerCase() === "true" || rowData.col7?.toLowerCase() === "yes" || rowData.col7?.toLowerCase() === "1";
    const isStudent = rowData.col5.includes("Student");

    return (
      <tr
        className={`${speakerColors[rowData.col5] || "bg-gray-100"} 
          ${hasNote ? "font-bold" : ""} 
          ${isSelectedForLineEdit ? "ring-2 ring-blue-500" : ""}
          ${!isRowSelectableForNote ? "opacity-50" : ""} 
          ${!isStudent ? "opacity-50" : ""}
        `}
      >
        {/* Select column */}
        {(isCreatingNote || editingLinesId !== null) && (
          <td className="w-12 px-2 py-1 border border-black border-2 text-center">
            {isRowSelectableForNote ? (
              isCreatingNote ? (
                <input
                  type="checkbox"
                  checked={selectedRows.includes(rowData.col2)}
                  onChange={() => toggleRowSelection(rowData.col2)}
                  className="form-checkbox h-4 w-4"
                />
              ) : (
                <input
                  type="checkbox"
                  checked={tempSelectedRows.includes(rowData.col2)}
                  onChange={() => toggleTempRowSelection(rowData.col2)}
                  className="form-checkbox h-4 w-4"
                />
              )
            ) : null}
          </td>
        )}

        {/* Standard columns */}
        {columnVisibility.lessonSegmentId && (
          <td className="px-2 py-1 border border-black border-2 text-sm text-gray-700 w-24">
            {rowData.col1}
          </td>
        )}
        {columnVisibility.lineNumber && (
          <td className="px-2 py-1 border border-black border-2 text-sm text-gray-700 w-24">
            {rowData.col2}
          </td>
        )}
        {columnVisibility.start && (
          <td className="px-2 py-1 border border-black border-2 text-sm text-gray-700 w-24">
            {rowData.col3}
          </td>
        )}
        {columnVisibility.end && (
          <td className="px-2 py-1 border border-black border-2 text-sm text-gray-700 w-24">
            {rowData.col4}
          </td>
        )}
        {columnVisibility.speaker && (
          <td className="px-2 py-1 border border-black border-2 text-sm text-gray-700 w-32">
            {rowData.col5}
          </td>
        )}
        {columnVisibility.utterance && (
          <td className="px-2 py-1 border border-black border-2 text-sm text-gray-700 w-auto overflow-auto whitespace-normal break-words">
            {rowData.col6}
          </td>
        )}

        {/* Notes Column */}
        {showNotesColumn && (
          <td className={`px-2 py-1 border border-black border-2 text-sm text-gray-700 ${columnVisibility.notes ? 'w-24' : 'w-12'}`}>
            {getNoteDisplayText(rowData.noteIds, rowData.col2 - 1)}
          </td>
        )}

        {/* Replace feature columns with the new component */}
        <FeatureColumns
          rowData={rowData}
          selectedFeature={selectedFeature}
          annotationData={annotationData}
          isStudent={isStudent}
          onFeatureChange={onFeatureChange}
        />
      </tr>
    );
  }, (prevProps, nextProps) => {
    // Less strict comparison function to ensure updates are caught
    if (!prevProps.annotationData || !nextProps.annotationData) return false;
    
    // Deep compare the annotations for this specific row
    const prevAnnotations = prevProps.selectedFeature && 
      prevProps.annotationData[prevProps.selectedFeature]?.annotations[prevProps.rowData.col2 - 1];
    const nextAnnotations = nextProps.selectedFeature && 
      nextProps.annotationData[nextProps.selectedFeature]?.annotations[nextProps.rowData.col2 - 1];
    
    const annotationsEqual = JSON.stringify(prevAnnotations) === JSON.stringify(nextAnnotations);
    
    return (
      prevProps.rowData === nextProps.rowData &&
      prevProps.selectedFeature === nextProps.selectedFeature &&
      annotationsEqual &&
      prevProps.selectedRows === nextProps.selectedRows &&
      prevProps.tempSelectedRows === nextProps.tempSelectedRows &&
      prevProps.editingLinesId === nextProps.editingLinesId &&
      prevProps.isCreatingNote === nextProps.isCreatingNote
    );
  });

  // Load data once when page loads
  useEffect(() => {
    // Try to load saved annotation data
    const savedAnnotations = localStorage.getItem(`annotations-${number}`);
    if (savedAnnotations) {
      setAnnotationData(JSON.parse(savedAnnotations));
    } else {
      // Initialize empty annotation data for all sheets
      const initialData: AnnotationData = {};
      ALLOWED_SHEETS.forEach(sheet => {
        initialData[sheet] = {
          codes: [],
          definitions: {},
          annotations: {}
        };
      });
      setAnnotationData(initialData);
    }
  }, [number]);

  // Save annotations when unmounting the component
  useEffect(() => {
    return () => {
      saveAllAnnotations(annotationData);
    };
  }, [annotationData]);

  // Add this useEffect to load Excel data when needed
  useEffect(() => {
    const loadExcelData = async () => {
      try {
        const response = await fetch('/MOL Roles Features.xlsx');
        if (!response.ok) {
          throw new Error(`Failed to fetch Excel file: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const workbook = read(arrayBuffer);
        
        // Start with existing data instead of fresh data
        const newData = annotationData ? { ...annotationData } : {};
        
        if (selectedFeature && workbook.SheetNames.includes(selectedFeature)) {
          const sheet = workbook.Sheets[selectedFeature];
          const jsonData = utils.sheet_to_json(sheet);
          
          // Extract codes and definitions
          const codes = jsonData
            .map(row => (row as any).Code)
            .filter(Boolean);
          
          const definitions: { [code: string]: FeatureDetails } = {};
          
          jsonData.forEach((row: any) => {
            const definition = row.Definition || row.definition;
            if (row.Code && definition) {
              definitions[row.Code] = {
                Definition: definition,
                example1: row.Example1 || row.example1 || '',
                example2: row.Example2 || row.example2 || '',
                nonexample1: row.NonExample1 || row.nonexample1 || '',
                nonexample2: row.NonExample2 || row.nonexample2 || ''
              };
            }
          });
          
          // Initialize annotations only if they don't exist for this sheet
          if (!newData[selectedFeature]) {
            const annotations: {
              [key: number]: {
                [code: string]: boolean;
              };
            } = {};
            
            for (let i = 0; i < tableData.length; i++) {
              annotations[i] = {};
              codes.forEach(code => {
                annotations[i][code] = false;
              });
            }
            
            newData[selectedFeature] = {
              codes,
              definitions,
              annotations
            };
          } else {
            // Update codes and definitions while preserving existing annotations
            newData[selectedFeature] = {
              ...newData[selectedFeature],
              codes,
              definitions
            };
          }
          
          setAnnotationData(newData);
        }
      } catch (error) {
        console.error('Error loading Excel file:', error);
      }
    };
    
    if (selectedFeature) {
      loadExcelData();
    }
  }, [selectedFeature, tableData.length, annotationData]);

  const handleSaveAnnotations = (data: AnnotationData) => {
    setAnnotationData(data);
    localStorage.setItem(`annotations-${number}`, JSON.stringify(data));
    alert('Annotations saved successfully!');
  };

  const handleAnnotationChange = (data: AnnotationData) => {
    setAnnotationData(data);
  };

  // Update the state interface to include examples and non-examples
  const [selectedFeaturePopup, setSelectedFeaturePopup] = useState<{
    code: string;
    definition: string;
    example1: string;
    nonexample1: string;
    position: { x: number; y: number };
  } | null>(null);

  const handleFeatureHeaderClick = (code: string, event: React.MouseEvent) => {
    event.preventDefault();
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const details = getFeatureDetails(code);
    setSelectedFeaturePopup({
      code,
      definition: details?.Definition || 'No definition available',
      example1: details?.example1 || '',
      nonexample1: details?.nonexample1 || '',
      position: {
        x: rect.left + rect.width / 2,
        y: rect.bottom + 10
      }
    });
  };

  // Add this just before the return statement
  const getFeatureDetails = (code: string): FeatureDetails | null => {
    if (!selectedFeature || !annotationData?.[selectedFeature]?.definitions) {
      return null;
    }
    return annotationData[selectedFeature].definitions[code];
  };

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const res = await fetch(`/t${number}/content.json`);
        if (!res.ok) throw new Error("Failed to fetch content.json");
        const data = await res.json();
        setGradeLevel(data.gradeLevel);
        setActivityPurpose(data.activityPurpose);
        setAvailableSegment(data.segments || []);
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
              col2: parseInt(row["#"], 10) || 10,
              col3: row["In cue"] || `Row ${index + 1} Col 3`,
              col4: row["Out cue"] || `Row ${index + 1} Col 4`,
              col5: row["Speaker"] || `Row ${index + 1} Col 5`,
              col6: row["Dialogue"] || `Row ${index + 1} Col 6`,
              col7: row["selectable"] || "false",
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
                    content_1: oldNote?.content_1 || "",
                    content_2: oldNote?.content_2 || "",
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

  const [scrollTop, setScrollTop] = useState(0);
  
  // Add scroll handler
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
  };

  // Add the export function after handleSubmit
  const handleExport = () => {
    if (!annotationData) return;

    // Create workbook
    const wb = utils.book_new();

    // For each feature sheet
    Object.entries(annotationData).forEach(([sheetName, sheetData]) => {
      // Create array for the current sheet's data
      const sheetRows = [];

      // Add header row with codes
      sheetRows.push(['Line #', 'Speaker', 'Utterance', ...sheetData.codes]);

      // Add data rows
      tableData.forEach((row, index) => {
        const isStudent = row.col5.includes('Student');
        const rowData = [
          row.col2, // Line #
          row.col5, // Speaker
          row.col6, // Utterance
          ...sheetData.codes.map(code => {
            if (!isStudent) return ''; // Empty for non-student speakers
            return sheetData.annotations[index]?.[code] ? '1' : '0';
          })
        ];
        sheetRows.push(rowData);
      });

      // Create worksheet and add to workbook
      const ws = utils.aoa_to_sheet(sheetRows);
      utils.book_append_sheet(wb, ws, sheetName);
    });

    // Save the workbook
    const fileName = `transcript_${number}_annotations.xlsx`;
    writeFile(wb, fileName);
  };

  // Optimize feature change handler with batched updates
  const handleFeatureChange = React.useCallback((lineNumber: number, code: string, value: boolean) => {
    if (!selectedFeature || !annotationData) return;
    
    setAnnotationData(prev => {
      if (!prev) return prev;
      
      const currentSheet = prev[selectedFeature];
      if (!currentSheet) return prev;

      const currentAnnotations = currentSheet.annotations[lineNumber];
      if (currentAnnotations?.[code] === value) return prev;

      return {
        ...prev,
        [selectedFeature]: {
          ...currentSheet,
          annotations: {
            ...currentSheet.annotations,
            [lineNumber]: {
              ...currentAnnotations,
              [code]: value
            }
          }
        }
      };
    });
  }, [selectedFeature, annotationData]);

  return (
    <div className="flex flex-col items-center min-h-screen w-full bg-white font-merriweather text-sm">
      {/* Header area with title and tabs */}
      <div className="w-full max-w-6xl p-4 mb-4">

        <div className="bg-gray-100 border rounded-lg p-4 mb-4">
        <h1 className="text-xl text-gray-800 mb-2 font-semibold">
        {`Prompt:`}
        </h1>
          <h2 className="text-xl text-gray-800 mb-2">
              <div>
              Consider the purpose for this lesson. What do you notice about what students say that would help you{" "}
              <strong>assess and/or advance</strong> their understanding toward that purpose?<i>
              (Select rows that provide sufficient evidence to allow you to{" "}
              <strong>assess and/or advance</strong> their understanding toward the lesson purpose.)</i>
              <br /> <br></br>
              In your notes, please answer the following two questions:<br />
              1. What are students saying in the selected piece(s) of evidence?<br />
              2. What does this piece of evidence(s) tell you about students' understanding and/or progress toward the lesson's purpose?
            </div>
          </h2>
        </div>
        
        <div className="bg-gray-100 border rounded-lg p-4 mb-4">
        <h1 className="text-xl text-gray-800 mb-2 font-semibold">
        {`Lesson purpose: `}{gradeLevel}
        </h1>
          <h2 className="text-xl text-gray-800 mb-2">
            {activityPurpose.split('\n').map((line, index) => (
              <span key={index}>
                ● {line}
                <br />
              </span>
            ))}
          </h2>
        </div>
      </div>

      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold text-gray-800 text-center">Click the button to view a particular lesson segment (full_transcript shows the entire lesson)</h2>
      </div>
      <div>
        {availableSegment.map((segment) => (
          <button
            key={segment}
            onClick={() => handleSegmentClick(segment)}
            className={`px-3 py-1 rounded-md text-sm text-white mr-2 ${
              whichSegment === segment ? 'bg-blue-500 hover:bg-blue-700' : 'bg-gray-400'
            }`}
          >
            {segment}
          </button>
        ))}
      </div>

      {/* Main 3-panel layout */}
        <div className="flex w-full max-w-8xl h-[calc(100vh-200px)] mb-4 relative">
          {/* Left Panel - Prompt and Grade Level */}
          <div className={`p-4 flex flex-col overflow-y-auto border-r border-gray-300 transition-all duration-300 ${showPromptPanel ? '' : 'w-0 p-0 overflow-hidden'}`} style={{ width: showPromptPanel ? leftPanelWidth : '0' }}>
            <div className="bg-gray-100 border rounded-lg shadow-md p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-semibold text-gray-800">Student-facing Lesson Prompts</h2>
                <button
                  onClick={() => setShowPromptPanel(false)}
                  className="px-2 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-md"
                >
                  Hide
                </button>
              </div>
              <Tab1 number={number} selectedSegment={whichSegment} />
            </div>
          </div>
        
        {/* Left Resize Handle */}
        <div 
          className={`${showPromptPanel ? 'w-1 bg-gray-300 hover:bg-blue-500 hover:w-2 cursor-col-resize z-10 transition-colors' : 'w-0'}`}
          onMouseDown={() => setIsDraggingLeft(true)}
        ></div>

        {/* Center Panel - Transcript Table */}
        <div className="p-4 flex flex-col border-r border-gray-300" style={{ width: showPromptPanel ? centerPanelWidth : 'calc(100% - ' + rightPanelWidth + ')' }}>
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                {!showPromptPanel && (
                  <button
                    onClick={() => setShowPromptPanel(true)}
                    className="px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded-md"
                  >
                    Show Prompts
                  </button>
                )}
            <h2 className="text-xl font-semibold text-gray-800 text-center">Transcript</h2>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowNotesColumn(prev => !prev)}
                  className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-md"
                >
                  {showNotesColumn ? 'Hide Notes' : 'Show Notes'}
                </button>
            {isCreatingNote ? (
              <div className="border border-gray-300 rounded-md bg-gray-100 p-4 my-3 max-w-md">
                <span className="mr-2 text-sm text-black italic">Select rows that provide <b className="font-bold">sufficient evidence</b> to allow you to assess and/or advance their understanding toward the lesson purpose. </span>
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
          </div>

            {/* Split into two rows: column toggles and feature buttons */}
            <div className="flex justify-between items-center">
              {/* Column toggle buttons on the left - only show for hidden columns */}
              <div className="flex flex-wrap gap-2">
                {!columnVisibility.lessonSegmentId && (
              <button
                    onClick={() => toggleColumnVisibility('lessonSegmentId')}
                    className="px-3 py-1 rounded-md text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    Show Segment ID
                  </button>
                )}
                {!columnVisibility.lineNumber && (
                  <button
                    onClick={() => toggleColumnVisibility('lineNumber')}
                    className="px-3 py-1 rounded-md text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    Show Line #
                  </button>
                )}
                {!columnVisibility.start && (
                  <button
                    onClick={() => toggleColumnVisibility('start')}
                    className="px-3 py-1 rounded-md text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    Show Start Time
                  </button>
                )}
                {!columnVisibility.end && (
                  <button
                    onClick={() => toggleColumnVisibility('end')}
                    className="px-3 py-1 rounded-md text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    Show End Time
                  </button>
                )}
                {!columnVisibility.speaker && (
                  <button
                    onClick={() => toggleColumnVisibility('speaker')}
                    className="px-3 py-1 rounded-md text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    Show Speaker
                  </button>
                )}
                {!columnVisibility.utterance && (
                  <button
                    onClick={() => toggleColumnVisibility('utterance')}
                    className="px-3 py-1 rounded-md text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    Show Utterance
                  </button>
                )}
              </div>

              {/* Feature buttons on the right */}
              <div className="flex gap-2">
                {ALLOWED_SHEETS.map(feature => (
                  <button
                    key={feature}
                    onClick={() => handleFeatureSelection(feature)}
                    className={`
                      px-3 py-1 rounded-md text-sm transition-all
                      hover:underline hover:decoration-2 hover:underline-offset-4
                      ${feature === selectedFeature 
                        ? 'bg-sky-600 text-white font-medium shadow-sm' 
                        : 'bg-sky-50 text-sky-600 hover:bg-sky-100 border border-sky-200'
                      }
                    `}
                  >
                    {feature}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-4 flex-grow">Loading transcript data...</div>
          ) : error ? (
            <div className="text-center py-4 text-red-500 flex-grow">{error}</div>
          ) : (
            <div className="overflow-y-auto flex-grow border">
              <table className="min-w-full table-auto border-collapse w-full border-2 border-black">
                <thead className="sticky top-0 bg-white z-10">
                  <tr>
                    {/* Checkbox column in header */}
                    {(isCreatingNote || editingLinesId !== null) && (
                      <th className="w-12 px-2 py-2 border border-black border-2 text-center">
                      </th>
                    )}

                    {/* Lesson Segment ID Column */}
                    {columnVisibility.lessonSegmentId && (
                      <th className={`px-2 py-2 border border-black border-2 text-black text-sm ${columnVisibility.lessonSegmentId ? 'w-24' : 'w-12'}`}>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={columnVisibility.lessonSegmentId}
                            onChange={() => toggleColumnVisibility('lessonSegmentId')}
                            className="mr-1"
                          />
                          Segment ID
                        </label>
                      </th>
                    )}

                    {/* Line Number Column */}
                    {columnVisibility.lineNumber && (
                      <th className={`px-2 py-2 border border-black border-2 text-black text-sm ${columnVisibility.lineNumber ? 'w-16' : 'w-12'}`}>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={columnVisibility.lineNumber}
                            onChange={() => toggleColumnVisibility('lineNumber')}
                            className="mr-1"
                          />
                          Line #
                        </label>
                      </th>
                    )}
                  
                    {/* Start Timestamp Column */}
                    {columnVisibility.start && (
                      <th className={`px-2 py-2 border border-black border-2  text-black text-sm ${columnVisibility.start ? 'w-24' : 'w-12'}`}>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={columnVisibility.start}
                            onChange={() => toggleColumnVisibility('start')}
                            className="mr-1"
                          />
                          Start timestamp
                        </label>
                      </th>
                    )}

                    {/* End Timestamp Column */}
                    {columnVisibility.end && (
                      <th className={`px-2 py-2 border border-black border-2 text-black text-sm ${columnVisibility.end ? 'w-24' : 'w-12'}`}>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={columnVisibility.end}
                            onChange={() => toggleColumnVisibility('end')}
                            className="mr-1"
                          />
                          End timestamp
                        </label>
                      </th>
                    )}

                    {/* Speaker Column */}
                    {columnVisibility.speaker && (
                      <th className={`px-2 py-2 border border-black border-2  text-black text-sm ${columnVisibility.speaker ? 'w-32' : 'w-12'}`}>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={columnVisibility.speaker}
                            onChange={() => toggleColumnVisibility('speaker')}
                            className="mr-1"
                          />
                          Speaker
                        </label>
                      </th>
                    )}
                    
                    {/* Utterance Column */}
                    {columnVisibility.utterance && (
                      <th className={`px-2 py-2 border border-black border-2 text-black text-sm ${columnVisibility.utterance ? 'w-auto' : 'w-12'}`}>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={columnVisibility.utterance}
                            onChange={() => toggleColumnVisibility('utterance')}
                            className="mr-1"
                          />
                          Utterance
                        </label>
                      </th>
                    )}
                    

                    {/* Notes Column */}
                    {showNotesColumn && (
                      <th className={`px-2 py-2 border border-black border-2 text-black text-sm ${columnVisibility.notes ? 'w-24' : 'w-12'}`}>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={columnVisibility.notes}
                            onChange={() => toggleColumnVisibility('notes')}
                            className="mr-1"
                          />
                          Notes
                        </label>
                      </th>
                    )}

                    {/* Feature Columns */}
                    {featureInfo.map(({ code, definition }) => {
                      const details = getFeatureDetails(code);
                      return (
                        <FeatureHeader 
                          key={code} 
                          code={code} 
                          definition={definition}
                          example1={details?.example1 || ''}
                          nonexample1={details?.nonexample1 || ''}
                        />
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {tableData
                    .filter(rowData => whichSegment === 'full_transcript' || rowData.col1 === whichSegment)
                    .map((rowData) => (
                      <TableRow
                        key={rowData.col2}
                        rowData={rowData}
                        selectedFeature={selectedFeature}
                        annotationData={annotationData}
                        onFeatureChange={handleFeatureChange}
                        speakerColors={speakerColors}
                        columnVisibility={columnVisibility}
                        showNotesColumn={showNotesColumn}
                        isCreatingNote={isCreatingNote}
                        editingLinesId={editingLinesId}
                        selectedRows={selectedRows}
                        tempSelectedRows={tempSelectedRows}
                        toggleRowSelection={toggleRowSelection}
                        toggleTempRowSelection={toggleTempRowSelection}
                        getNoteDisplayText={getNoteDisplayText}
                      />
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Right Resize Handle */}
        <div 
          className="w-1 bg-gray-300 hover:bg-blue-500 hover:w-2 cursor-col-resize z-10 transition-colors"
          onMouseDown={() => setIsDraggingRight(true)}
        ></div>

        {/* Right Panel - Analysis Notes */}
        <div className="p-4 flex flex-col overflow-hidden" style={{ width: rightPanelWidth }}>
          <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">Notes</h2>
          
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : (
            <div className="flex-grow flex flex-col overflow-hidden">
              {isAnnotating ? (
                <div className="flex-grow flex flex-col overflow-hidden">
                  <AnnotationPanel
                    numRows={tableData.length}
                    onSave={handleSaveAnnotations}
                    savedData={annotationData || undefined}
                    onAnnotationChange={handleAnnotationChange}
                  />
                </div>
          ) : (
            <div className="flex-grow overflow-y-auto">
                  {notes.length > 0 ? (
                    notes.map((note) => {
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
                              ✎ Edit note title
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
                      ✎ Edit (add or remove lines)
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
                    <div className="text-black">
                    {`Q1: What are students saying in the selected piece(s) of evidence?`}
                    </div>
                    <textarea
                      value={note.content_1}
                      onChange={(e) => handleNoteContentChange1(note.id, e.target.value)}
                      rows={3}
                      className="w-full p-2 border rounded resize-none text-sm text-black"
                      placeholder="Type your response here..."
                    />
                    <div className="text-black">
                          {`Q2: What does this piece of evidence(s) tell you about students' understanding and/or progress toward the lesson's purpose?`}
                    </div>
                    <textarea
                      value={note.content_2}
                      onChange={(e) => handleNoteContentChange2(note.id, e.target.value)}
                      rows={4}
                      className="w-full p-2 border rounded resize-none text-sm text-black"
                      placeholder="Type your response here..."
                    />
                  </div>
                );
                    })
                  ) : (
                <div className="text-center py-4 text-gray-500 italic">
                  {'No notes yet. Click "New Note" to begin.'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
        </div>
      </div>
      
      {/* High level comments field */}
      <div className="w-full max-w-6xl p-4 flex flex-col items-center">
            <h3 className="font-semibold text-gray-800 mb-2 text-sm">What other evidence would you have liked to access in order to assess and/or advance students' understanding/progress toward the purpose?</h3>
            <textarea
              className="w-full h-32 p-2 border rounded resize-y text-sm text-black"
              placeholder="Please write your response here..."
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
            />
      </div>

      {/* Footer area with email and buttons */}
      <div className="w-full max-w-6xl p-4 flex flex-col items-center">
        <div className="w-full max-w-xs mb-4">
          <label htmlFor="email" className="block text-sm font-medium text-black">
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

          <button
            onClick={handleExport}
            className="px-6 py-2 bg-green-500 text-white font-semibold rounded-md hover:bg-green-700 transition"
          >
            Export to Excel
          </button>
        </div>
      </div>

      {selectedFeaturePopup && selectedFeaturePopup.definition && (
        <FeaturePopup
          code={selectedFeaturePopup.code}
          definition={selectedFeaturePopup.definition}
          example1={selectedFeaturePopup.example1}
          nonexample1={selectedFeaturePopup.nonexample1}
          position={selectedFeaturePopup.position}
          onClose={() => setSelectedFeaturePopup(null)}
        />
      )}
    </div>
  );
}