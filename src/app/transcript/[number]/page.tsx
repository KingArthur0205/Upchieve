/* eslint-disable */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Tab1 from "../../tabs/tab1";
import Papa from "papaparse";
import AnnotationPanel, { AnnotationData, FeatureDetails } from "../../components/AnnotationPanel";
import { read, utils, writeFile, write } from "xlsx";
import FeaturePopup from "../../components/FeaturePopup";
import React from "react";
// Create a simple debounce function to replace lodash dependency
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T {
  let timeout: NodeJS.Timeout;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}
import LLMComparisonView from "../../components/LLMComparisonView";
import LLMAnalysisComparisonView from "../../components/LLMAnalysisComparisonView";
import ExpertsComparisonView from "../../components/ExpertsComparisonView";
import UnifiedComparisonView from "../../components/UnifiedComparisonView";

interface CsvRow {
  "#": string;
  "In cue": string;
  "Out cue": string;
  "Speaker": string;
  "Dialogue": string;
  "Segment": string;
  "selectable"?: string;
  "Selectable"?: string;
  [key: string]: string | undefined; // For any other columns that might exist
}

// Interface for a single learning goal note
interface Note {
  content_1: string;
  content_2: string;
  id: number;      // Numeric ID for the learning goal note
  title: string;   // User-editable title
  rowIndices: number[]; // Track which rows this learning goal note belongs to
  lineNumbers: number[]; // Explicit line numbers for this note (redundant but ensures preservation)
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
  noteIds: string; // This will store the comma-separated learning goal note IDs (read-only)
}

// Types for the feature columns component
interface FeatureColumnsProps {
  rowData: TableRow;
  selectedFeature: string | null;
  annotationData: AnnotationData | null;
  isStudent: boolean;
  isSelectable: boolean; // Add this prop
  onFeatureChange: (lineNumber: number, code: string, value: boolean) => void;
  onHoverChange?: (isHovering: boolean) => void;
}

export default function TranscriptPage() {
  const params = useParams();
  const router = useRouter();
  const number = params.number as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gradeLevel, setGradeLevel] = useState("");
  const [lessonGoal, setLessonGoal] = useState("");
  const [showLessonGoal, setShowLessonGoal] = useState(true);
  const [speakerColors, setSpeakerColors] = useState<{ [key: string]: string }>({});
  const [availableSegment, setAvailableSegment] = useState<string []>([]);
  const [whichSegment, setWhichSegment] = useState<string>("full_transcript");
  const [showPromptPanel, setShowPromptPanel] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState({
    lessonSegmentId: true,
    lineNumber: true,
    start: false,
    end: false,
    speaker: true,
    utterance: true,
    notes: true
  });

  // CRITICAL FIX: Move dropdown states to parent level to persist across re-renders
  const [expandedDropdowns, setExpandedDropdowns] = useState<{[key: string]: boolean}>({});
  const [dropdownPositions, setDropdownPositions] = useState<{[key: string]: 'bottom' | 'top' | 'left' | 'right'}>({});
  const [openedDropdowns, setOpenedDropdowns] = useState<{[key: string]: boolean}>({});
  const [showFeatureOverview, setShowFeatureOverview] = useState<string | null>(null);
  const [showLLMComparison, setShowLLMComparison] = useState(false);
  const [llmAnnotationData, setLlmAnnotationData] = useState<AnnotationData | null>(null);
  const [showLLMAnalysisComparison, setShowLLMAnalysisComparison] = useState(false);
  const [llmAnalysisData, setLlmAnalysisData] = useState<{
    notes: Record<string, unknown>[];
    transcript: Record<string, unknown>[];
  } | null>(null);
  const [showExpertsComparison, setShowExpertsComparison] = useState(false);
  const [expertsAnnotationData, setExpertsAnnotationData] = useState<{
    notes: Record<string, unknown>[];
    transcript: Record<string, unknown>[];
  } | null>(null);
  const [showUnifiedComparison, setShowUnifiedComparison] = useState(false);

  // Add these state variables at the top of your component
  const [leftPanelWidth, setLeftPanelWidth] = useState("33.33%"); // Default 2/6
  const [centerPanelWidth, setcenterPanelWidth] = useState("66.67%"); // Default 4/6 - right panel removed
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);

  // Search functionality state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentSearchMatch, setCurrentSearchMatch] = useState<number>(-1);
  const [searchMatches, setSearchMatches] = useState<number[]>([]);

  // Add these handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLeft) {
        const newWidth = (e.clientX / window.innerWidth) * 100;
        // Set limits (min 15%, max 85%)
        const limitedWidth = Math.min(Math.max(newWidth, 15), 85);
        setLeftPanelWidth(`${limitedWidth}%`);
        
        // Recalculate center panel width (no right panel)
        const remainingWidth = 100 - limitedWidth;
        setcenterPanelWidth(`${remainingWidth}%`);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingLeft(false);
    };

    if (isDraggingLeft) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingLeft, leftPanelWidth]);

  const toggleColumnVisibility = (columnKey: keyof typeof columnVisibility) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };
  // Store learning goal notes separately from table data
  const [notes, setNotes] = useState<Note[]>([]);
  const [nextNoteId, setNextNoteId] = useState(1);
  // Add this with your other state declarations
  const [availableIds, setAvailableIds] = useState<number[]>([]);
  const [annotationData, setAnnotationData] = useState<AnnotationData | null>(null);
  
  // State for new learning goal note creation
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  
  // Track which learning goal note title is currently being edited
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  
  // NEW: Track which learning goal note lines are being edited
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
      noteIds: "", // Comma-separated learning goal note IDs (read-only)
    }))
  );

  // Function to check if a table row is selectable by row data
  const isTableRowSelectable = (rowData: TableRow): boolean => {
    const selectableValue = rowData.col7?.toLowerCase();
      return selectableValue === "true" || selectableValue === "yes" || selectableValue === "1";
  };

  // Function to parse learning goal note IDs from a comma-separated string
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
    // Find the row data to check if it's selectable
    const rowData = tableData.find(row => row.col2 === col2Value);
    if (!rowData || !isTableRowSelectable(rowData)) return;
    
    if (selectedRows.includes(col2Value)) {
      setSelectedRows(selectedRows.filter(id => id !== col2Value));
    } else {
      setSelectedRows([...selectedRows, col2Value]);
    }
  };

  // Toggle selection of a row for line number editing
  const toggleTempRowSelection = (col2Value: number) => {
    // Find the row data to check if it's selectable
    const rowData = tableData.find(row => row.col2 === col2Value);
    if (!rowData || !isTableRowSelectable(rowData)) return;
    
      if (tempSelectedRows.includes(col2Value)) {
        setTempSelectedRows(tempSelectedRows.filter(id => id !== col2Value));
      } else {
        setTempSelectedRows([...tempSelectedRows, col2Value]);
    }
  };

  // Start the learning goal note creation process
  const startNoteCreation = () => {
    setIsCreatingNote(true);
    setSelectedRows([]);
  };
  
  // Cancel learning goal note creation
  const cancelNoteCreation = () => {
    setIsCreatingNote(false);
    setSelectedRows([]);
  };

  // Search functionality
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    
    if (!term.trim()) {
      setSearchMatches([]);
      setCurrentSearchMatch(-1);
      return;
    }

    const filteredData = tableData.filter(rowData => {
      if (whichSegment === 'student_only') {
        return rowData.col5.includes('Student');
      }
      return whichSegment === 'full_transcript' || rowData.col1 === whichSegment;
    });

    const matches: number[] = [];
    const searchLower = term.toLowerCase();
    
    // Check if search term is a number (line number search)
    const isLineNumber = /^\d+$/.test(term.trim());
    
    filteredData.forEach((row, index) => {
      if (isLineNumber) {
        // Search by line number
        if (row.col2.toString() === term.trim()) {
          matches.push(index);
        }
      } else {
        // Search by utterance text
        if (row.col6.toLowerCase().includes(searchLower)) {
          matches.push(index);
        }
      }
    });
    
    setSearchMatches(matches);
    setCurrentSearchMatch(matches.length > 0 ? 0 : -1);
    
    // Scroll to first match
    if (matches.length > 0) {
      scrollToMatch(matches[0]);
    }
  };

  const navigateSearch = (direction: 'next' | 'prev') => {
    if (searchMatches.length === 0) return;
    
    let nextIndex = currentSearchMatch;
    if (direction === 'next') {
      nextIndex = (currentSearchMatch + 1) % searchMatches.length;
    } else {
      nextIndex = currentSearchMatch === 0 ? searchMatches.length - 1 : currentSearchMatch - 1;
    }
    
    setCurrentSearchMatch(nextIndex);
    scrollToMatch(searchMatches[nextIndex]);
  };

  const scrollToMatch = (tableIndex: number) => {
    const rowElement = document.querySelector(`[data-row-index="${tableIndex}"]`);
    if (rowElement) {
      rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchMatches([]);
    setCurrentSearchMatch(-1);
  };

  // Function to create a new learning goal note with specific rows
  const handleCreateNoteWithRows = (rowIndices: number[]) => {
    if (rowIndices.length === 0) return;
    
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
    
    // Get the line numbers (col2 values) for the selected row indices
    const lineNumbers = rowIndices.map(index => tableData[index]?.col2).filter(lineNum => lineNum !== undefined);
    
    // Create new learning goal note with empty title (will be named in edit window)
    const updatedNotes = [...notes, {
      id: noteId,
      title: "",
      content_1: "",
      content_2: "",
      rowIndices: rowIndices,
      lineNumbers: lineNumbers
    }];
    
    // Update table data learning goal note IDs
    const updatedTableData = tableData.map((row, index) => ({
      ...row,
      noteIds: rowIndices.includes(index) 
        ? [...parseNoteIds(row.noteIds), noteId].join(', ')
        : row.noteIds
    }));
    
    setTableData(updatedTableData);
    setNotes(updatedNotes);
    
    // Automatically open the note for editing
    const noteRows = updatedNotes[updatedNotes.length - 1].rowIndices.map(rowIndex => {
      if (rowIndex >= 0 && rowIndex < tableData.length) {
        return tableData[rowIndex];
      }
      return null;
    }).filter((row): row is TableRow => row !== null);
    
    setSelectedNotePopup({ 
      note: updatedNotes[updatedNotes.length - 1], 
      noteRows 
    });
  };

  // Function to create a new learning goal note
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
    
    // Convert selectedRows (col2 values) to array indices for storage
    const rowIndices = selectedRows.map(col2Value => 
      tableData.findIndex(row => row.col2 === col2Value)
    ).filter(index => index !== -1);
    
    // Create new learning goal note with empty title (will be named in edit window)
    const updatedNotes = [...notes, {
      id: noteId,
      title: "",
      content_1: "",
      content_2: "",
      rowIndices: rowIndices,
      lineNumbers: selectedRows
    }];
    
    // Update table data learning goal note IDs
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
    
    // Automatically open the note for editing
    const noteRows = updatedNotes[updatedNotes.length - 1].rowIndices.map(rowIndex => {
      if (rowIndex >= 0 && rowIndex < tableData.length) {
        return tableData[rowIndex];
      }
      return null;
    }).filter((row): row is TableRow => row !== null);
    
    setSelectedNotePopup({ 
      note: updatedNotes[updatedNotes.length - 1], 
      noteRows 
    });
  };

  // Handle learning goal note content changes
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

  // NEW: Functions for learning goal note line number editing
  
  // Start editing line numbers
  const startLinesEdit = (noteId: number) => {
    const note = notes.find(note => note.id === noteId);
    if (note) {
      // Convert rowIndices (array indices) to col2 values for selection
      const col2Values = note.rowIndices.map(index => 
        tableData[index]?.col2
      ).filter(col2 => col2 !== undefined);
      
      setTempSelectedRows(col2Values);
      setEditingLinesId(noteId);
    }
  };
  
  // Save line number edits
  const saveLinesEdit = (noteId: number) => {
    // Find the learning goal note to update
    const updatedNotes = [...notes];
    const noteIndex = updatedNotes.findIndex(note => note.id === noteId);
    
    if (noteIndex === -1) {
      setEditingLinesId(null);
      return;
    }
    
    const oldRowIndices = updatedNotes[noteIndex].rowIndices;
    
    // Convert tempSelectedRows (col2 values) to array indices
    const newRowIndices = tempSelectedRows.map(col2Value => 
      tableData.findIndex(row => row.col2 === col2Value)
    ).filter(index => index !== -1);
    
    // Update the learning goal note's row indices and line numbers
    updatedNotes[noteIndex].rowIndices = newRowIndices;
    updatedNotes[noteIndex].lineNumbers = tempSelectedRows;
    
    // Update table data
    const updatedTableData = [...tableData];
    
    // Remove learning goal note ID from rows that were removed
    oldRowIndices.forEach(rowIndex => {
      if (!newRowIndices.includes(rowIndex)) {
        const currentIds = parseNoteIds(updatedTableData[rowIndex].noteIds);
        const updatedIds = currentIds.filter(id => id !== noteId);
        updatedTableData[rowIndex].noteIds = updatedIds.join(', ');
      }
    });
    
    // Add learning goal note ID to rows that were added
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

  // Delete a learning goal note from the analysis panel
  const handleDeleteNote = (noteId: number) => {
    // Find the learning goal note to delete
    const noteToDelete = notes.find(note => note.id === noteId);
    if (!noteToDelete) return;
    
    // Remove ID from all associated rows
    const updatedData = [...tableData];
    noteToDelete.rowIndices.forEach(rowIndex => {
      const currentIds = parseNoteIds(updatedData[rowIndex].noteIds);
      const updatedIds = currentIds.filter(id => id !== noteId);
      updatedData[rowIndex].noteIds = updatedIds.join(', ');
    });
    
    // Remove learning goal note from notes collection
    const updatedNotes = notes.filter(note => note.id !== noteId);
    
    // Add this ID to the available list
    setAvailableIds([...availableIds, noteId]);
    
    setTableData(updatedData);
    setNotes(updatedNotes);
  };

  // Save Function (Stores data locally)
  const handleSave = () => {
    const dataToSave = { tableData, notes, nextNoteId, availableIds };
    console.log(dataToSave);
    localStorage.setItem(`tableData-${number}`, JSON.stringify(dataToSave));
    alert("Data saved successfully!");
  };

  // State for save status indicator
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  
  // State for upload status
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  // Auto-save function (silent save without alert)
  const autoSave = useCallback(() => {
    setSaveStatus('saving');
    const dataToSave = { tableData, notes, nextNoteId, availableIds };
    localStorage.setItem(`tableData-${number}`, JSON.stringify(dataToSave));
    console.log("Data auto-saved");
    
    // Show saved status for 2 seconds
    setTimeout(() => setSaveStatus('saved'), 500);
  }, [tableData, notes, nextNoteId, availableIds, number]);

  // Auto-save whenever data changes (debounced to avoid excessive saves)
  const debouncedAutoSave = useCallback(
    debounce(autoSave, 1000), // Save 1 second after last change
    [autoSave]
  );

  // Effect to trigger auto-save when data changes
  useEffect(() => {
    // Don't auto-save on initial load or when data is still loading
    if (loading || !mounted) return;
    
    setSaveStatus('unsaved');
    debouncedAutoSave();
  }, [tableData, notes, nextNoteId, availableIds, debouncedAutoSave, loading, mounted]);

  // Save data before page unload
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Force save data immediately before page closes
      const dataToSave = { tableData, notes, nextNoteId, availableIds };
      localStorage.setItem(`tableData-${number}`, JSON.stringify(dataToSave));
      
      if (annotationData) {
        localStorage.setItem(`annotations-${number}`, JSON.stringify(annotationData));
      }
      
      console.log("Data saved before page unload");
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [tableData, notes, nextNoteId, availableIds, annotationData, number]);

  // Submit Function (Sends data to backend)
  const handleSubmit = async () => {
    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableData, notes, transcriptNumber: number }),
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

  // Get learning goal note title by ID for display in the table
  const getNoteDisplayById = (noteId: number): string => {
    const note = notes.find(note => note.id === noteId);
    return note ? note.id.toString() : "";
  };

  const handleSegmentClick = (segment: string) => {
    setWhichSegment(segment);
  };

  // Function to get display titles for the table - now returns clickable elements
  const getNoteDisplayText = (idsString: string, rowIndex: number): React.ReactNode => {
    const ids = parseNoteIds(idsString);
    if (ids.length === 0) return "—";
    
    return ids.map((id: number, index: number) => {
      const note = notes.find(n => n.id === id);
      if (!note) return null;
      
      return (
        <React.Fragment key={id}>
          {index > 0 && ", "}
          <button
            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
            onClick={(e) => {
              e.stopPropagation(); // Prevent the cell click handler from firing
              const noteRows = generateNoteRows(note);
              setSelectedNotePopup({ note, noteRows });
              // Reset edit mode when opening a note
              setIsNoteInEditMode(false);
              setNoteEditBuffer(null);
            }}
            title={`Click to view note: ${note.title}`}
          >
            {note.title || `Note ${id}`}
          </button>
        </React.Fragment>
      );
    }).filter(Boolean);
  };

  const [showNotesColumn, setShowNotesColumn] = useState(true);

  const ALLOWED_SHEETS = ["Conceptual", "Discursive"];

  // Function to save all annotations
  const saveAllAnnotations = (data: AnnotationData | null) => {
    if (!data) return;
    localStorage.setItem(`annotations-${number}`, JSON.stringify(data));
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
        inline-flex rounded-md select-none shadow-sm
        ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <button
        type="button"
        disabled={isDisabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isDisabled) onToggle(false);
        }}
        className={`
          min-w-[32px] px-3 py-1 text-xs font-bold rounded-l-md border-r border-white/20
          transition-all duration-150 ease-in-out
          ${isChecked 
            ? 'bg-gray-200 text-gray-500 hover:bg-gray-300' 
            : 'bg-red-600 text-white shadow-md hover:bg-red-700 active:bg-red-800'
          }
          ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        No
      </button>
      <button
        type="button"
        disabled={isDisabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isDisabled) onToggle(true);
        }}
          className={`
          min-w-[32px] px-3 py-1 text-xs font-bold rounded-r-md
          transition-all duration-150 ease-in-out
          ${isChecked 
            ? 'bg-emerald-600 text-white shadow-md hover:bg-emerald-700 active:bg-emerald-800' 
            : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
          }
          ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        Yes
      </button>
    </div>
  ), (prev, next) => 
    prev.isChecked === next.isChecked && 
    prev.isDisabled === next.isDisabled
  );
  FeatureToggle.displayName = 'FeatureToggle';

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
        // const rect = e.currentTarget.getBoundingClientRect();
        // setSelectedFeaturePopup({
        //   code,
        //   definition,
        //   example1,
        //   nonexample1,
        //   position: {
        //     x: rect.left + rect.width / 2,
        //     y: rect.bottom + 10
        //   }
        // });
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
    isSelectable, // Add this prop
    onFeatureChange,
    onHoverChange
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
              isDisabled={!isStudent || !isSelectable} // Add isSelectable check
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
    if (prev.isSelectable !== next.isSelectable) return false; // Add this check
    if (!prev.selectedFeature || !next.selectedFeature) return true;

    const prevRow = prev.annotationData?.[prev.selectedFeature]?.annotations[prev.rowData.col2 - 1];
    const nextRow = next.annotationData?.[next.selectedFeature]?.annotations[next.rowData.col2 - 1];
    return prevRow === nextRow; // Direct reference comparison instead of JSON stringify
  });

  // New CollapsibleFeatureCell component for the new design
  const CollapsibleFeatureCell = React.memo(({ 
    rowData,
    category,
    annotationData,
    isStudent,
    onFeatureChange
  }: {
    rowData: TableRow;
    category: string;
    annotationData: AnnotationData | null;
    isStudent: boolean;
    onFeatureChange: (lineNumber: number, code: string, value: boolean) => void;
  }) => {
    // Check if row is selectable for annotations
    const isSelectable = isTableRowSelectable(rowData);
    
    // CRITICAL FIX: Use parent-level state instead of local state
    const dropdownKey = `${rowData.col2}-${category}`;
    const isExpanded = expandedDropdowns[dropdownKey] || false;
    const dropdownPosition = dropdownPositions[dropdownKey] || 'bottom';
    
    const [showAnnotationWindow, setShowAnnotationWindow] = useState(false);
    const [selectedDefinition, setSelectedDefinition] = useState<{
      code: string;
      definition: string;
      example1: string;
      nonexample1: string;
      position: { x: number; y: number };
    } | null>(null);

    // Add click-outside-to-close functionality
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (isExpanded) {
          const target = event.target as HTMLElement;
          // Check if the click is outside the dropdown
          if (!target.closest(`[data-dropdown="true"][data-dropdown-key="${dropdownKey}"]`) &&
              !target.closest(`[data-cell-key="${dropdownKey}"]`)) {
            setExpandedDropdowns(prev => ({ ...prev, [dropdownKey]: false }));
          }
        }
      };

      if (isExpanded) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isExpanded, dropdownKey]);
    
    if (!annotationData?.[category]) {
      return (
        <td className="px-2 py-1 border border-black border-2 text-center">
          <div className="text-xs text-black">—</div>
        </td>
      );
    }

    const rowIndex = rowData.col2 - 1;
    const rowAnnotations = annotationData[category].annotations[rowIndex] || {};
    const codes = annotationData[category].codes;
    
    // Calculate how many features are "Yes" (true)
    const yesCount = codes.filter(code => rowAnnotations[code]).length;
    const totalCount = codes.length;

    // Determine background color based on selection state
    const getCellColor = () => {
      if (!isStudent) return "bg-gray-100";
      // Removed gray-out for non-selectable rows - keep them with normal colors
      
      // HIGHLIGHT: Show yellow if dropdown has ever been opened (stays yellow permanently)
      if (openedDropdowns[dropdownKey]) return "bg-yellow-200";
      
      if (yesCount === 0) return "bg-white";
      if (yesCount === totalCount) return "bg-green-100";
      return "bg-yellow-100"; // Partial selection
    };

    const handleFeatureClick = (code: string, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      const details = annotationData[category].definitions[code];
      if (details) {
        setSelectedDefinition({
          code,
          definition: details.Definition || 'No definition available',
          example1: details.example1 || '',
          nonexample1: details.nonexample1 || '',
          position: {
            x: rect.left + rect.width / 2,
            y: rect.bottom + 10
          }
        });
      }
      // Ensure dropdown stays open
      return false;
    };

    const calculateDropdownPosition = (cellElement: HTMLElement) => {
      const rect = cellElement.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const dropdownHeight = 300; // Estimated dropdown height
      const dropdownWidth = 256; // min-w-64 = 256px

      // Check vertical space
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // Check horizontal space
      const spaceRight = viewportWidth - rect.right;
      const spaceLeft = rect.left;

      // Determine best position
      if (spaceBelow >= dropdownHeight) {
        return 'bottom';
      } else if (spaceAbove >= dropdownHeight) {
        return 'top';
      } else if (spaceRight >= dropdownWidth) {
        return 'right';
      } else if (spaceLeft >= dropdownWidth) {
        return 'left';
      } else {
        return 'bottom'; // Default fallback
      }
    };

    const handleCellClick = (event: React.MouseEvent) => {
      if (isStudent && isSelectable) { // Add isSelectable check
        event.preventDefault();
        event.stopPropagation();
        
        // Toggle the dropdown - close if already open, open if closed
        if (isExpanded) {
          // Close the dropdown if it's currently open
          setExpandedDropdowns(prev => ({ ...prev, [dropdownKey]: false }));
        } else {
          // Open the dropdown if it's currently closed
          const cellElement = event.currentTarget as HTMLElement;
          const position = calculateDropdownPosition(cellElement);
          setDropdownPositions(prev => ({ ...prev, [dropdownKey]: position }));
          setExpandedDropdowns(prev => ({ ...prev, [dropdownKey]: true }));
          // Mark this dropdown as having been opened at least once
          setOpenedDropdowns(prev => ({ ...prev, [dropdownKey]: true }));
        }
      }
    };

    const handleOpenAnnotationWindow = (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setShowAnnotationWindow(true);
      setExpandedDropdowns(prev => ({ ...prev, [dropdownKey]: false }));
    };

    const handleCloseDropdown = () => {
      setExpandedDropdowns(prev => ({ ...prev, [dropdownKey]: false }));
    };

    const handleCloseAnnotationWindow = () => {
      setShowAnnotationWindow(false);
    };

    const handleCloseDefinition = () => {
      setSelectedDefinition(null);
    };

    const getDropdownClasses = () => {
      const baseClasses = "absolute bg-white border-2 border-gray-800 rounded-lg shadow-lg z-40 min-w-64 p-3";
      
      switch (dropdownPosition) {
        case 'top':
          return `${baseClasses} bottom-full left-1/2 transform -translate-x-1/2 mb-1`;
        case 'right':
          return `${baseClasses} top-0 left-full ml-1`;
        case 'left':
          return `${baseClasses} top-0 right-full mr-1`;
        case 'bottom':
        default:
          return `${baseClasses} top-full left-1/2 transform -translate-x-1/2 mt-1`;
      }
    };

    return (
      <>
        <td 
          className={`px-2 py-1 border border-black border-2 text-center relative cursor-pointer ${getCellColor()}`}
          onClick={handleCellClick}
          data-cell-key={dropdownKey}
        >
          {isStudent ? (
            <div className="text-xs font-medium relative">
              {/* Summary display */}
              <div className={yesCount > 0 ? 'text-green-700' : 'text-black'}>
                {isSelectable ? `${yesCount}/${totalCount}` : '—'}
                </div>
              
              {/* Dropdown expansion */}
              {isExpanded && (
                <div 
                  className={getDropdownClasses()}
                  onClick={(e) => e.stopPropagation()}
                  data-dropdown="true"
                  data-dropdown-key={dropdownKey}
                >
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-sm font-semibold text-gray-800">
                      {category} Features
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleOpenAnnotationWindow}
                        className="text-blue-600 hover:text-blue-800 text-xs"
                        title="Open full annotation window"
                      >
                        ⤢
                      </button>
                      <button
                        onClick={handleCloseDropdown}
                        className="text-gray-500 hover:text-gray-700 text-lg leading-none"
                        title="Close"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {codes.map((code: string) => (
                      <div key={code} className="flex items-center justify-between text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <div className="flex items-center flex-1">
                          <input
                            type="checkbox"
                            checked={rowAnnotations[code] || false}
                            onChange={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                                onFeatureChange(rowData.col2 - 1, code, e.target.checked);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            className="mr-2 form-checkbox h-3 w-3 text-blue-600"
                            disabled={!isStudent}
                          />
                          <button
                            className="text-sky-600 hover:text-sky-800 hover:underline text-left flex-1"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleFeatureClick(code, e);
                              return false;
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            title="Click for definition and examples"
                          >
                            {code}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-black">—</div>
          )}
        </td>

        {/* Separate Annotation Window */}
        {showAnnotationWindow && isStudent && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50"
            onClick={handleCloseAnnotationWindow}
          >
            <div 
              className="bg-white border-2 border-gray-800 rounded-lg shadow-lg p-4 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-3">
                <div className="text-lg font-semibold text-gray-800">
                  {category} Features
                </div>
                <button
                  onClick={handleCloseAnnotationWindow}
                  className="text-gray-500 hover:text-gray-700 text-xl leading-none"
                  title="Close"
                >
                  ×
                </button>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {codes.map((code: string) => (
                  <div key={code} className="flex items-center justify-between">
                    <button
                      className="text-sky-600 hover:text-sky-800 hover:underline text-left mr-3 flex-1 text-sm"
                      onClick={(e) => handleFeatureClick(code, e)}
                      title="Click for definition and examples"
                    >
                      {code}
                    </button>
                    <div onClick={(e) => e.stopPropagation()}>
                      <FeatureToggle
                        isChecked={rowAnnotations[code] || false}
                        isDisabled={!isStudent}
                        onToggle={(checked) => {
                          onFeatureChange(rowIndex, code, checked);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Separate Definition Popup */}
        {selectedDefinition && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50"
            onClick={handleCloseDefinition}
          >
            <div 
              className="bg-blue-50 border-2 border-blue-300 rounded-lg shadow-lg p-4 max-w-lg w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-3">
                <div className="text-lg font-semibold text-blue-800">
                  {selectedDefinition.code}
                </div>
                <button
                  onClick={handleCloseDefinition}
                  className="text-blue-500 hover:text-blue-700 text-xl leading-none"
                  title="Close"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="text-sm text-gray-700">
                  <strong className="text-blue-800">Definition:</strong>
                  <div className="mt-1">{selectedDefinition.definition}</div>
                </div>
                
                {selectedDefinition.example1 && (
                  <div className="text-sm text-green-700">
                    <strong className="text-green-800">Example:</strong>
                    <div className="mt-1">{selectedDefinition.example1}</div>
                  </div>
                )}
                
                {selectedDefinition.nonexample1 && (
                  <div className="text-sm text-red-700">
                    <strong className="text-red-800">Non-example:</strong>
                    <div className="mt-1">{selectedDefinition.nonexample1}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }, (prevProps, nextProps) => {
    // Custom comparison: Only re-render if THIS specific row's annotations change
    const prevRowData = prevProps.rowData;
    const nextRowData = nextProps.rowData;
    
    // Basic props comparison
    if (prevRowData.col2 !== nextRowData.col2 || 
        prevProps.category !== nextProps.category ||
        prevProps.isStudent !== nextProps.isStudent) {
      return false; // Re-render if basic props changed
    }
    
    // Check if annotation data for THIS specific row changed
    if (!prevProps.annotationData || !nextProps.annotationData) return false;
    
    const prevCategoryData = prevProps.annotationData[prevProps.category];
    const nextCategoryData = nextProps.annotationData[nextProps.category];
    
    if (!prevCategoryData || !nextCategoryData) return false;
    
    const rowIndex = prevRowData.col2 - 1;
    const prevRowAnnotations = prevCategoryData.annotations[rowIndex];
    const nextRowAnnotations = nextCategoryData.annotations[rowIndex];
    
    // Only re-render if THIS row's annotations changed
    return JSON.stringify(prevRowAnnotations) === JSON.stringify(nextRowAnnotations);
  });

  // Memoize the filtered table data
  const filteredTableData = React.useMemo(() => {
    return tableData.filter(rowData => {
      // Handle student_only filter
      if (whichSegment === 'student_only') {
        return rowData.col5.includes('Student');
      }
      // Handle segment-based filtering
      return whichSegment === 'full_transcript' || rowData.col1 === whichSegment;
    });
  }, [tableData, whichSegment]);

  // Optimize the debounced save to be less aggressive
  const debouncedSave = React.useCallback(
    debounce((data: AnnotationData) => {
      localStorage.setItem(`annotations-${number}`, JSON.stringify(data));
    }, 2000), // Increased debounce time to reduce storage operations
    [number]
  );

  // Add new state for learning goal note popup
  const [learningGoalNotePopup, setLearningGoalNotePopup] = useState<{
    rowIndex: number;
    rowData: TableRow;
    position: { x: number; y: number };
    mode: 'initial' | 'creating'; // Add mode to track popup state
  } | null>(null);

  // Add state for new note title during creation
  const [newNoteTitle, setNewNoteTitle] = useState('');

  // Update TableRow component to handle learning goal note cell clicks
  const TableRow = React.memo(({ 
    rowData, 
    rowIndex,
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
    rowIndex: number;
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
    getNoteDisplayText: (idsString: string, rowIndex: number) => React.ReactNode;
  }) => {
    const hasNote = rowData.noteIds.trim() !== "";
    const isSelectedForLineEdit = editingLinesId !== null && tempSelectedRows.includes(+rowData.col2);
    const isRowSelectableForNote = isTableRowSelectable(rowData);
    const isStudent = rowData.col5.includes("Student");
    const isSelectedForNoteCreation = isCreatingNote && selectedRows.includes(rowData.col2);

    // Search highlighting
    const isSearchMatch = searchMatches.includes(rowIndex);
    const isCurrentMatch = currentSearchMatch >= 0 && searchMatches[currentSearchMatch] === rowIndex;

    const handleLearningGoalNoteCellClick = (e: React.MouseEvent) => {
      if (!isRowSelectableForNote) return;
      
      const rect = e.currentTarget.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const popupHeight = 300; // Approximate max height of popup
      const popupWidth = 250; // minWidth of popup
      
      // Calculate available space in each direction
      const spaceRight = viewportWidth - rect.right;
      const spaceLeft = rect.left;
      
      // Determine position
      let top: number;
      let left: number;
      
      // First try to position to the right of the cell
      if (spaceRight >= popupWidth) {
        left = rect.right;
        top = rect.top;
        
        // If popup would go off the bottom, move it up
        if (top + popupHeight > viewportHeight) {
          top = Math.max(0, viewportHeight - popupHeight);
        }
      }
      // If not enough space on right, try left
      else if (spaceLeft >= popupWidth) {
        left = rect.left - popupWidth;
        top = rect.top;
        
        // If popup would go off the bottom, move it up
        if (top + popupHeight > viewportHeight) {
          top = Math.max(0, viewportHeight - popupHeight);
        }
      }
      // If not enough space on either side, position below
      else {
        left = rect.left;
        if (rect.bottom + popupHeight <= viewportHeight) {
          top = rect.bottom;
        } else {
          top = rect.top - popupHeight;
        }
      }
      
      setLearningGoalNotePopup({
        rowIndex,
        rowData,
        position: {
          x: left,
          y: top
        },
        mode: 'initial'
      });
    };

    return (
      <tr
        data-row-index={rowIndex}
        className={`${speakerColors[rowData.col5] || "bg-gray-100"} 
          ${hasNote ? "font-bold" : ""} 
          ${isSelectedForLineEdit ? "ring-2 ring-blue-500" : ""}
          ${isSelectedForNoteCreation ? "ring-2 ring-green-500" : ""}
          ${isCurrentMatch ? "ring-2 ring-yellow-400 bg-yellow-100" : 
            isSearchMatch ? "bg-yellow-50" : ""}
        `}
      >
        {/* Select column */}
        {(isCreatingNote || editingLinesId !== null) && (
          <td className="w-12 px-2 py-2 border border-black border-2 text-center">
            {isRowSelectableForNote ? (
              isCreatingNote ? (
                <input
                  type="checkbox"
                  checked={selectedRows.includes(rowData.col2)}
                  onChange={() => toggleRowSelection(rowData.col2)}
                  className="form-checkbox h-4 w-4 text-green-500 focus:ring-green-500"
                />
              ) : (
                <input
                  type="checkbox"
                  checked={tempSelectedRows.includes(rowData.col2)}
                  onChange={() => toggleTempRowSelection(rowData.col2)}
                  className="form-checkbox h-4 w-4 text-blue-500 focus:ring-blue-500"
                />
              )
            ) : (
              <span className="text-black text-xs">N/A</span>
            )}
          </td>
        )}

        {/* Standard columns */}
        {columnVisibility.lessonSegmentId && (
          <td className="px-2 py-1 border border-black border-2 text-sm text-black w-24">
            {rowData.col1}
          </td>
        )}
        {columnVisibility.lineNumber && (
          <td className="px-2 py-1 border border-black border-2 text-sm text-black w-24">
            {rowData.col2}
          </td>
        )}
        {columnVisibility.start && (
          <td className="px-2 py-1 border border-black border-2 text-sm text-black w-24">
            {rowData.col3}
          </td>
        )}
        {columnVisibility.end && (
          <td className="px-2 py-1 border border-black border-2 text-sm text-black w-24">
            {rowData.col4}
          </td>
        )}
        {columnVisibility.speaker && (
          <td className="px-2 py-1 border border-black border-2 text-sm text-black w-32">
            {rowData.col5}
          </td>
        )}
        {columnVisibility.utterance && (
          <td className="px-2 py-1 border border-black border-2 text-sm text-black w-auto overflow-auto whitespace-normal break-words">
            {isSearchMatch && searchTerm && !(/^\d+$/.test(searchTerm.trim())) ? (
              <span dangerouslySetInnerHTML={{
                __html: rowData.col6.replace(
                  new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                  '<mark class="bg-yellow-300">$1</mark>'
                )
              }} />
            ) : (
              rowData.col6
            )}
          </td>
        )}

        {/* Notes Column */}
        {showNotesColumn && (
          <td 
            className={`px-2 py-1 border border-black border-2 text-sm text-black ${columnVisibility.notes ? 'w-24' : 'w-12'} 
              ${isRowSelectableForNote ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed'} 
              relative group`}
            onClick={handleLearningGoalNoteCellClick}
          >
            {getNoteDisplayText(rowData.noteIds, rowData.col2 - 1)}
            {!isRowSelectableForNote && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-gray-500">Not eligible for notes</span>
              </div>
            )}
          </td>
        )}

        {/* Replace feature columns with the new component */}
        {ALLOWED_SHEETS.map(category => (
          <CollapsibleFeatureCell
            key={category}
          rowData={rowData}
            category={category}
          annotationData={annotationData}
          isStudent={isStudent}
          onFeatureChange={onFeatureChange}
        />
        ))}
      </tr>
    );
  }, (prevProps, nextProps) => {
    // Simplified comparison function
    if (!prevProps.annotationData || !nextProps.annotationData) return false;
    
    return (
      prevProps.rowData === nextProps.rowData &&
      prevProps.rowIndex === nextProps.rowIndex &&
      prevProps.annotationData === nextProps.annotationData &&
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

  // Add this useEffect to load annotation data when needed
  useEffect(() => {
    const loadAnnotationData = async () => {
      try {
        console.log('Starting to load annotation data from XLSX');
        
        let newData = annotationData ? { ...annotationData } : {};
        
          console.log('Loading XLSX file /MOL Roles Features.xlsx');
          const xlsxResponse = await fetch('/MOL%20Roles%20Features.xlsx');
          if (!xlsxResponse.ok) {
            throw new Error(`Failed to fetch annotation file: ${xlsxResponse.statusText}`);
          }
          const arrayBuffer = await xlsxResponse.arrayBuffer();
          newData = parseXLSXAnnotationData(arrayBuffer, newData);
          console.log('XLSX data parsed successfully');
        
        console.log('Setting annotation data:', newData);
        setAnnotationData(newData);
      } catch (error) {
        console.error('Error loading annotation data:', error);
      }
    };
    
    // Load annotation data when component mounts or tableData changes
    if (tableData.length > 0) {
      loadAnnotationData();
    }
  }, [tableData.length]);



  // Function to parse XLSX annotation data (extracted from existing logic)
  const parseXLSXAnnotationData = (arrayBuffer: ArrayBuffer, existingData: AnnotationData): AnnotationData => {
    const workbook = read(arrayBuffer);
    console.log('Excel file loaded. Sheet names:', workbook.SheetNames);
    console.log('Allowed sheets:', ALLOWED_SHEETS);
    
    const newData = { ...existingData };
    
    // Load all allowed sheets
    ALLOWED_SHEETS.forEach(sheetName => {
      if (workbook.SheetNames.includes(sheetName)) {
        console.log('Processing sheet:', sheetName);
        const sheet = workbook.Sheets[sheetName];
        const jsonData = utils.sheet_to_json(sheet);
        
        console.log(`Sheet ${sheetName} data:`, jsonData.slice(0, 3));
        
        // Extract codes and definitions
        const codes = (jsonData as {Code?: string}[])
          .map(row => row.Code)
          .filter((code): code is string => Boolean(code));
        
        console.log(`Codes found in ${sheetName}:`, codes);
        
        const definitions: { [code: string]: FeatureDetails } = {};
        
        (jsonData as {
          Code?: string;
          Definition?: string;
          definition?: string;
          Example1?: string;
          example1?: string;
          Example2?: string;
          example2?: string;
          NonExample1?: string;
          nonexample1?: string;
          NonExample2?: string;
          nonexample2?: string;
        }[]).forEach(row => {
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
        if (!newData[sheetName] || newData[sheetName].codes.length === 0) {
          console.log('Creating new annotation data for:', sheetName);
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
          
          newData[sheetName] = {
            codes,
            definitions,
          annotations
        };
        } else {
          // Update codes and definitions while preserving existing annotations
          newData[sheetName] = {
            ...newData[sheetName],
            codes,
            definitions
          };
        }
      }
    });
    
    return newData;
  };

  const handleSaveAnnotations = (data: AnnotationData) => {
    setAnnotationData(data);
    localStorage.setItem(`annotations-${number}`, JSON.stringify(data));
    alert('Annotations saved successfully!');
  };

  const handleAnnotationChange = (data: AnnotationData) => {
    setAnnotationData(data);
    
    // Auto-save annotations when they change
    localStorage.setItem(`annotations-${number}`, JSON.stringify(data));
    console.log("Annotations auto-saved");
  };

  // Update the state interface to include examples and non-examples
  const [selectedFeaturePopup, setSelectedFeaturePopup] = useState<{
    code: string;
    definition: string;
    example1: string;
    nonexample1: string;
    position: { x: number; y: number };
  } | null>(null);

  // const handleFeatureHeaderClick = (code: string, event: React.MouseEvent) => {
  //   event.preventDefault();
  //   const rect = (event.target as HTMLElement).getBoundingClientRect();
  //   const details = getFeatureDetails(code);
  //   setSelectedFeaturePopup({
  //     code,
  //     definition: details?.Definition || 'No definition available',
  //     example1: details?.example1 || '',
  //     nonexample1: details?.nonexample1 || '',
  //     position: {
  //       x: rect.left + rect.width / 2,
  //       y: rect.bottom + 10
  //     }
  //   });
  // };

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const res = await fetch(`/t${number}/content.json`);
        if (!res.ok) throw new Error("Failed to fetch content.json");
        const data = await res.json();
        setGradeLevel(data.gradeLevel);
        setLessonGoal(data.lessonGoal || "");
        setAvailableSegment(data.segments || []);
      } catch (err) {
        console.error("Error loading content:", err);
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
              col1: row["Segment"] || `Row ${index + 1} Col 1`,
              col2: parseInt(row["#"], 10) || 10,
              col3: row["In cue"] || `Row ${index + 1} Col 3`,
              col4: row["Out cue"] || `Row ${index + 1} Col 4`,
              col5: row["Speaker"] || `Row ${index + 1} Col 5`,
              col6: row["Dialogue"] || `Row ${index + 1} Col 6`,
              col7: row["selectable"] || row["Selectable"] || "false",
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
            parsedData.tableData.forEach((row: any, rowIndex: number) => {
              const oldTitles = row.noteTitle ? row.noteTitle.split(',').map((t: string) => t.trim()).filter((t: string) => t !== "") : [];
              
              oldTitles.forEach((oldTitle: string) => {
                if (!titleToIdMap.has(oldTitle)) {
                  // Create a new ID for this title
                  const newId = highestId + 1;
                  highestId = newId;
                  titleToIdMap.set(oldTitle, newId);
                  
                  const oldNote = parsedData.notes?.find((n: any) => n.title === oldTitle);
                  
                  migratedNotes.push({
                    id: newId,
                    title: oldTitle,
                    content_1: oldNote?.content_1 || "",
                    content_2: oldNote?.content_2 || "",
                    rowIndices: [rowIndex],
                    lineNumbers: [parsedData.tableData[rowIndex]?.col2 || rowIndex + 1]
                  });
                } else {
                  // Add this row to the existing note
                  const existingNoteId = titleToIdMap.get(oldTitle);
                  const existingNote = migratedNotes.find(n => n.id === existingNoteId);
                  if (existingNote && !existingNote.rowIndices.includes(rowIndex)) {
                    existingNote.rowIndices.push(rowIndex);
                    const lineNumber = parsedData.tableData[rowIndex]?.col2 || rowIndex + 1;
                    if (!existingNote.lineNumbers.includes(lineNumber)) {
                      existingNote.lineNumbers.push(lineNumber);
                    }
                  }
                }
              });
            });
            
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
            
            // Ensure all notes have lineNumbers field
            const notesWithLineNumbers = (parsedData.notes || []).map((note: any) => ({
              ...note,
              lineNumbers: note.lineNumbers || note.rowIndices.map((index: number) => 
                parsedData.tableData[index]?.col2 || index + 1
              )
            }));
            
            setNotes(notesWithLineNumbers);
            setNextNoteId(parsedData.nextNoteId || Math.max(...parsedData.notes.map((n: Note) => n.id), 0) + 1);
          }
          

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

  // Set mounted state after initial load
  useEffect(() => {
    if (!loading) {
      setMounted(true);
    }
  }, [loading]); 
  
  const getRowColor = (speaker: string, speakerColors: { [key: string]: string }) => {
    return speakerColors[speaker] || "bg-gray-100"; // Default to gray if speaker is not found
  };

  // Generate rows for a specific learning goal note
  const generateNoteRows = (note: Note) => {
    return note.rowIndices.map(rowIndex => {
      if (rowIndex >= 0 && rowIndex < tableData.length) {
        return tableData[rowIndex];
      }
      return null;
    }).filter((row): row is TableRow => row !== null);
  };

  // Functions to handle note popup edit mode
  const enterNoteEditMode = (note: Note) => {
    setIsNoteInEditMode(true);
    setNoteEditBuffer({
      title: note.title,
      content_1: note.content_1,
      content_2: note.content_2
    });
  };

  const exitNoteEditMode = () => {
    setIsNoteInEditMode(false);
    setNoteEditBuffer(null);
  };

  const saveNoteChanges = () => {
    if (selectedNotePopup && noteEditBuffer) {
      const noteId = selectedNotePopup.note.id;
      
      // Update the note with buffer values
      setNotes(prevNotes => 
        prevNotes.map(note => 
          note.id === noteId 
            ? { ...note, title: noteEditBuffer.title, content_1: noteEditBuffer.content_1, content_2: noteEditBuffer.content_2 }
            : note
        )
      );

      // Update the popup note reference
      setSelectedNotePopup(prev => 
        prev ? {
          ...prev,
          note: { ...prev.note, title: noteEditBuffer.title, content_1: noteEditBuffer.content_1, content_2: noteEditBuffer.content_2 }
        } : null
      );

      exitNoteEditMode();
    }
  };

  const cancelNoteChanges = () => {
    exitNoteEditMode();
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

    // Add Notes sheet if there are any notes
    if (notes.length > 0) {
      const notesRows = [];
      
      // Add header row for notes
      notesRows.push(['Note ID', 'Title', 'Note Abstract', 'Full Context', 'Associated Lines', 'Associated Utterances']);
      
      // Add each note as a row
      notes.forEach(note => {
        // Get the line numbers and utterances for this note
        const associatedLines = note.lineNumbers?.length > 0 
          ? note.lineNumbers.join(', ')
          : note.rowIndices.map(index => {
              const tableRow = tableData[index];
              return tableRow ? tableRow.col2 : '';
            }).filter(line => line !== '').join(', ');
        
        const associatedUtterances = note.rowIndices.map(index => {
          const tableRow = tableData[index];
          return tableRow ? `"${tableRow.col6}"` : '';
        }).filter(utterance => utterance !== '""').join('; ');
        
        notesRows.push([
          note.id,
          note.title,
          note.content_1,
          note.content_2,
          associatedLines,
          associatedUtterances
        ]);
      });
      
      // Create notes worksheet and add to workbook
      const notesWs = utils.aoa_to_sheet(notesRows);
      utils.book_append_sheet(wb, notesWs, 'Notes');
    }

    // Save the workbook
    const fileName = `transcript_${number}_annotations.xlsx`;
    writeFile(wb, fileName);
  };

  // Function to upload XLSX file to Google Cloud Storage
  const handleUploadToCloud = async () => {
    if (!annotationData) {
      alert('No annotation data to upload');
      return;
    }

    setUploadStatus('uploading');

    try {
      // Create the Excel workbook (same logic as export)
      const wb = utils.book_new();

      // For each feature sheet
      Object.entries(annotationData).forEach(([sheetName, sheetData]) => {
        const sheetRows = [];
        sheetRows.push(['Line #', 'Speaker', 'Utterance', ...sheetData.codes]);

        tableData.forEach((row, index) => {
          const isStudent = row.col5.includes('Student');
          const rowData = [
            row.col2, // Line #
            row.col5, // Speaker
            row.col6, // Utterance
            ...sheetData.codes.map(code => {
              if (!isStudent) return '';
              return sheetData.annotations[index]?.[code] ? '1' : '0';
            })
          ];
          sheetRows.push(rowData);
        });

        const ws = utils.aoa_to_sheet(sheetRows);
        utils.book_append_sheet(wb, ws, sheetName);
      });

      // Add Notes sheet if there are any notes
      if (notes.length > 0) {
        const notesRows = [];
        notesRows.push(['Note ID', 'Title', 'Note Abstract', 'Full Context', 'Associated Lines', 'Associated Utterances']);
        
        notes.forEach(note => {
          const associatedLines = note.lineNumbers?.length > 0 
            ? note.lineNumbers.join(', ')
            : note.rowIndices.map(index => {
                const tableRow = tableData[index];
                return tableRow ? tableRow.col2 : '';
              }).filter(line => line !== '').join(', ');
          
          const associatedUtterances = note.rowIndices.map(index => {
            const tableRow = tableData[index];
            return tableRow ? `"${tableRow.col6}"` : '';
          }).filter(utterance => utterance !== '""').join('; ');
          
          notesRows.push([
            note.id,
            note.title,
            note.content_1,
            note.content_2,
            associatedLines,
            associatedUtterances
          ]);
        });
        
        const notesWs = utils.aoa_to_sheet(notesRows);
        utils.book_append_sheet(wb, notesWs, 'Notes');
      }

      // Convert workbook to buffer
      const wbBinary = write(wb, { bookType: 'xlsx', type: 'array' });
      
      // Create a blob from the binary data
      const blob = new Blob([wbBinary], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      // Create FormData for file upload
      const formData = new FormData();
      const fileName = `transcript_${number}_annotations_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
      formData.append('file', blob, fileName);
      formData.append('transcriptNumber', number.toString());

      console.log('Uploading XLSX file to Google Cloud Storage:', {
        fileName: fileName,
        fileSize: blob.size,
        transcriptNumber: number
      });

      // Send to our API that uploads to Google Cloud Storage
      const response = await fetch('/api/upload-xlsx', {
        method: 'POST',
        body: formData,
      });

      const responseData = await response.json();
      console.log('Upload response:', responseData);

      if (response.ok) {
        setUploadStatus('success');
        alert('Successfully uploaded XLSX file to Google Cloud Storage!');
        setTimeout(() => setUploadStatus('idle'), 3000); // Reset after 3 seconds
      } else {
        console.error('Upload failed with response:', responseData);
        throw new Error(responseData.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading to cloud:', error);
      setUploadStatus('error');
      
      // More detailed error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to upload XLSX file to Google Cloud Storage.\n\nError: ${errorMessage}\n\nPlease check:\n1. Google Cloud credentials are configured\n2. Bucket permissions are set correctly\n3. Network connection is stable`);
      setTimeout(() => setUploadStatus('idle'), 5000); // Reset after 5 seconds for error
    }
  };

    // Handle Compare with LLM
  const handleCompareWithLLM = async () => {
    try {
      console.log('Loading LLM annotations...');
      
      let llmData: AnnotationData = {};
      let dataLoaded = false;
      
      // Try to load Excel format first (multiple sheets)
      try {
        const excelResponse = await fetch(`/t${number}/annotated_transcript.xlsx`);
        if (excelResponse.ok) {
          console.log('Loading LLM annotations from annotated_transcript.xlsx');
          const arrayBuffer = await excelResponse.arrayBuffer();
          const workbook = read(arrayBuffer);
          
          console.log('LLM annotation file loaded. Sheet names:', workbook.SheetNames);
          
          const ALL_SHEETS = ["Conceptual", "Discursive", "Lexical", "Talk"];
          
          // Load all sheets from LLM annotations
          ALL_SHEETS.forEach(sheetName => {
            if (workbook.SheetNames.includes(sheetName)) {
              console.log('Processing LLM sheet:', sheetName);
              const sheet = workbook.Sheets[sheetName];
              
              const jsonData = utils.sheet_to_json(sheet, { 
                defval: null,
                raw: false
              });
              
              // Extract codes from the first row (headers)
              const headers = Object.keys(jsonData[0] || {});
              console.log(`${sheetName} sheet headers:`, headers);
              
              const codes = headers.filter(header => 
                header !== 'Line #' && 
                header !== 'Speaker' && 
                header !== 'Utterance' &&
                header !== '#' &&
                header !== 'Dialogue' &&
                header !== 'Segment'  // For Talk sheet, exclude Segment from codes
              );
              
              console.log(`${sheetName} sheet codes:`, codes);
              
              // Convert LLM data to our annotation format
              const annotations: { [key: number]: { [code: string]: any } } = {};
              
              jsonData.forEach((row: any, rowIndex: number) => {
                if (sheetName === 'Talk') {
                  // For Talk sheet, use row index directly since it's summary data
                  annotations[rowIndex] = {};
                  
                  codes.forEach(code => {
                    const value = row[code];
                    let processedValue;
                    
                    // For Talk sheet, preserve the original data types
                    if (code === 'Response Latency' || code === 'Turn Latency') {
                      // Handle latency values as decimal numbers
                      processedValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                    } else if (typeof value === 'string' && !isNaN(Number(value))) {
                      processedValue = Number(value);
                    } else if (typeof value === 'number') {
                      processedValue = value;
                    } else {
                      processedValue = value;
                    }
                    
                    annotations[rowIndex][code] = processedValue;
                  });
                  
                  // Also store metadata for Talk sheet
                  annotations[rowIndex]['Segment'] = row['Segment'];
                  annotations[rowIndex]['Speaker'] = row['Speaker'];
                  
                  // Handle duration columns specifically
                  if (row['Total Duration']) {
                    annotations[rowIndex]['Total Duration'] = row['Total Duration'];
                  }
                  if (row['Duration']) {
                    annotations[rowIndex]['Duration'] = row['Duration'];
                  }
                  
                  // Handle latency columns specifically
                  if (row['Response Latency']) {
                    annotations[rowIndex]['Response Latency'] = parseFloat(row['Response Latency']) || 0;
                  }
                  if (row['Turn Latency']) {
                    annotations[rowIndex]['Turn Latency'] = parseFloat(row['Turn Latency']) || 0;
                  }
                  
                  // Handle crosstalk variations
                  if (row['Crosstalk Count'] !== undefined) {
                    annotations[rowIndex]['Crosstalk Count'] = Number(row['Crosstalk Count']) || 0;
                  } else if (row['Crosstalk'] !== undefined) {
                    annotations[rowIndex]['Crosstalk Count'] = Number(row['Crosstalk']) || 0;
                  } else if (row['CrossTalk'] !== undefined) {
                    annotations[rowIndex]['Crosstalk Count'] = Number(row['CrossTalk']) || 0;
                  } else if (row['Cross Talk'] !== undefined) {
                    annotations[rowIndex]['Crosstalk Count'] = Number(row['Cross Talk']) || 0;
                  }
                } else {
                  const lineNumber = row['Line #'] || row['#'] || row['Line Number'];
                  
                  if (lineNumber) {
                    // Find the corresponding table row index by matching line numbers
                    const tableRowIndex = tableData.findIndex(tableRow => tableRow.col2 === parseInt(lineNumber, 10));
                    
                    if (tableRowIndex >= 0) {
                      annotations[tableRowIndex] = {};
                      
                      codes.forEach(code => {
                        const value = row[code];
                        let processedValue;
                        if (sheetName === 'Lexical') {
                          // For Lexical category, keep numeric values
                          processedValue = typeof value === 'number' ? value : (parseInt(value) || 0);
                        } else {
                          // For Conceptual, Discursive categories, convert to boolean
                          if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) {
                            processedValue = false;
                          } else {
                            processedValue = Number(value) === 1 || value === 1 || value === 1.0 || value === "1" || value === true || value === "true";
                          }
                        }
                        annotations[tableRowIndex][code] = processedValue;
                      });
                    }
                  }
                }
              });
              
              llmData[sheetName] = {
                codes,
                definitions: annotationData?.[sheetName]?.definitions || {},
                annotations
              };
            }
          });
          
          dataLoaded = true;
        }
      } catch (excelError) {
        console.log('Excel file not found or error loading it, trying CSV format...');
      }
      
      // If Excel didn't work, try CSV format (single file with all annotations)
      if (!dataLoaded) {
        try {
          const csvResponse = await fetch(`/t${number}/annotated_transcript.csv`);
          if (csvResponse.ok) {
            console.log('Loading LLM annotations from annotated_transcript.csv');
            const csvText = await csvResponse.text();
            
            // Parse CSV using Papa Parse
            const { data: csvData } = Papa.parse(csvText, {
              header: true,
              skipEmptyLines: true
            });
            
            console.log('CSV data loaded:', csvData.slice(0, 3));
            
            // Get all available annotation columns (excluding metadata columns)
            const metadataColumns = ['#', 'In cue', 'Out cue', 'Duration', 'Speaker', 'Language', 'Dialogue', 'Annotations', 'Error Type', 'Segment', 'Selectable'];
            const allHeaders = Object.keys(csvData[0] || {});
            const annotationColumns = allHeaders.filter(header => !metadataColumns.includes(header));
            
            console.log('Available annotation columns:', annotationColumns);
            
            // Group annotation columns by category based on known patterns
            const conceptualCodes = annotationColumns.filter(col => [
              'explain_reason', 'claim_math', 'apology', 'question_s', 'compare', 'agree', 'revoice', 'redirect', 
              'help_math', 'nextstep', 'question_g', 'addon', 'disagree', 'explain_action', 'help_non', 
              'Mathcompetent', 'Langcompetent', 'Understanding'
            ].includes(col));
            
            const discursiveCodes = annotationColumns.filter(col => [
              'Offtask', 'Recording', 'Directions'
            ].includes(col));
            
            const lexicalCodes = annotationColumns.filter(col => {
              // Add any LIWC or lexical analysis columns here if they exist
              const lexicalColumns: string[] = [];
              return lexicalColumns.includes(col);
            });
            
            // Create annotation data for each category
            if (conceptualCodes.length > 0) {
              const conceptualAnnotations: { [key: number]: { [code: string]: any } } = {};
              
              csvData.forEach((row: any) => {
                const lineNumber = parseInt(row['#']);
                if (!isNaN(lineNumber)) {
                  const tableRowIndex = tableData.findIndex(tableRow => tableRow.col2 === lineNumber);
                  
                  if (tableRowIndex >= 0) {
                    conceptualAnnotations[tableRowIndex] = {};
                    
                    conceptualCodes.forEach(code => {
                      const value = row[code];
                      let processedValue;
                      if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) {
                        processedValue = false;
                      } else {
                        // Convert to boolean: only 1 or "1" or true should be true
                        processedValue = Number(value) === 1 || value === 1 || value === 1.0 || value === "1" || value === true || value === "true";
                      }
                      conceptualAnnotations[tableRowIndex][code] = processedValue;
                    });
                  }
                }
              });
              
              llmData['Conceptual'] = {
                codes: conceptualCodes,
                definitions: annotationData?.['Conceptual']?.definitions || {},
                annotations: conceptualAnnotations
              };
            }
            
            if (discursiveCodes.length > 0) {
              const discursiveAnnotations: { [key: number]: { [code: string]: any } } = {};
              
              csvData.forEach((row: any) => {
                const lineNumber = parseInt(row['#']);
                if (!isNaN(lineNumber)) {
                  const tableRowIndex = tableData.findIndex(tableRow => tableRow.col2 === lineNumber);
                  
                  if (tableRowIndex >= 0) {
                    discursiveAnnotations[tableRowIndex] = {};
                    
                    discursiveCodes.forEach(code => {
                      const value = row[code];
                      let processedValue;
                      if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) {
                        processedValue = false;
                      } else {
                        // Convert to boolean: only 1 or "1" or true should be true
                        processedValue = Number(value) === 1 || value === 1 || value === 1.0 || value === "1" || value === true || value === "true";
                      }
                      discursiveAnnotations[tableRowIndex][code] = processedValue;
                    });
                  }
                }
              });
              
              llmData['Discursive'] = {
                codes: discursiveCodes,
                definitions: annotationData?.['Discursive']?.definitions || {},
                annotations: discursiveAnnotations
              };
            }
            
            dataLoaded = true;
          }
        } catch (csvError) {
          console.error('Error loading CSV format:', csvError);
        }
      }
      
      if (dataLoaded) {
        console.log('Setting LLM annotation data:', llmData);
        setLlmAnnotationData(llmData);
        setShowLLMComparison(true);
      } else {
        throw new Error('No LLM annotation files found');
      }
      
    } catch (error) {
      console.error('Error loading LLM annotations:', error);
      alert('Failed to load LLM annotations. Please check if annotated_transcript.xlsx or annotated_transcript.csv exists in the transcript folder.');
    }
  };

  // Handle Compare with Experts
  const handleCompareWithExperts = async () => {
    try {
      console.log('Loading expert annotations...');
      
      const excelResponse = await fetch(`/t${number}/expert_annotations.xlsx`);
      if (!excelResponse.ok) {
        throw new Error('Expert annotations file not found');
      }
      
      const arrayBuffer = await excelResponse.arrayBuffer();
      const workbook = read(arrayBuffer);
      
      console.log('Expert annotation file loaded. Sheet names:', workbook.SheetNames);
      
      // Find the notes sheet - try multiple possible names
      const possibleNotesSheetNames = ['What Students Are Saying', 'Notes', 'Student Notes', 'What Students are Saying'];
      let notesSheet = null;
      let notesSheetName = '';
      
      for (const sheetName of possibleNotesSheetNames) {
        if (workbook.Sheets[sheetName]) {
          notesSheet = workbook.Sheets[sheetName];
          notesSheetName = sheetName;
          break;
        }
      }
      
      if (!notesSheet) {
        // If no notes sheet found, try the first sheet that isn't "Annotated Transcript"
        const firstNonTranscriptSheet = workbook.SheetNames.find(name => 
          !name.toLowerCase().includes('annotated') && !name.toLowerCase().includes('transcript')
        );
        if (firstNonTranscriptSheet) {
          notesSheet = workbook.Sheets[firstNonTranscriptSheet];
          notesSheetName = firstNonTranscriptSheet;
          console.log(`Using sheet "${firstNonTranscriptSheet}" as notes sheet`);
        } else {
          throw new Error(`Notes sheet not found. Available sheets: ${workbook.SheetNames.join(', ')}`);
        }
      } else {
        console.log(`Found notes sheet: "${notesSheetName}"`);
      }
      
      const notesData = utils.sheet_to_json(notesSheet, { 
        defval: null,
        raw: false
      });
      
      // Fix column names - the visible columns are named "Expert 1.1", "Expert 2.1", etc.
      // but should be "Expert 1", "Expert 2", etc. to match the transcript sheet
      const fixedNotesData = notesData.map(row => {
        const fixedRow: Record<string, unknown> = {};
        if (row && typeof row === 'object') {
          for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
            if (key === 'Expert 1.1') {
              fixedRow['Expert 1'] = value;
            } else if (key === 'Expert 2.1') {
              fixedRow['Expert 2'] = value;
            } else if (key === 'Expert 3.1') {
              fixedRow['Expert 3'] = value;
            } else {
              fixedRow[key] = value;
            }
          }
        }
        return fixedRow;
      });
      
      // Find the transcript sheet - try multiple possible names
      const possibleTranscriptSheetNames = ['Annotated Transcript', 'Transcript', 'Annotations', 'Annotated transcript'];
      let transcriptSheet = null;
      let transcriptSheetName = '';
      
      for (const sheetName of possibleTranscriptSheetNames) {
        if (workbook.Sheets[sheetName]) {
          transcriptSheet = workbook.Sheets[sheetName];
          transcriptSheetName = sheetName;
          break;
        }
      }
      
      if (!transcriptSheet) {
        // If no transcript sheet found, try the first sheet that isn't the notes sheet
        const firstNonNotesSheet = workbook.SheetNames.find(name => name !== notesSheetName);
        if (firstNonNotesSheet) {
          transcriptSheet = workbook.Sheets[firstNonNotesSheet];
          transcriptSheetName = firstNonNotesSheet;
          console.log(`Using sheet "${firstNonNotesSheet}" as transcript sheet`);
        } else {
          throw new Error(`Transcript sheet not found. Available sheets: ${workbook.SheetNames.join(', ')}`);
        }
      } else {
        console.log(`Found transcript sheet: "${transcriptSheetName}"`);
      }
      
      const transcriptData = utils.sheet_to_json(transcriptSheet, { 
        defval: null,
        raw: false
      });
      
      console.log('Expert notes data:', notesData.slice(0, 3));
      console.log('Expert transcript data:', transcriptData.slice(0, 3));
      
      setExpertsAnnotationData({
        notes: fixedNotesData as Record<string, unknown>[],
        transcript: transcriptData as Record<string, unknown>[]
      });
      setShowExpertsComparison(true);
      
    } catch (error) {
      console.error('Error loading expert annotations:', error);
      alert('Failed to load expert annotations. Please check if expert_annotations.xlsx exists in the transcript folder.');
    }
  };

  // Handle Compare with LLM Analysis (transcript_analysis.xlsx)
  const handleCompareWithLLMAnalysis = async () => {
    try {
      console.log('Loading LLM analysis annotations...');
      
      const excelResponse = await fetch(`/t${number}/transcript_analysis.xlsx`);
      if (!excelResponse.ok) {
        throw new Error('LLM analysis file not found');
      }
      
      const arrayBuffer = await excelResponse.arrayBuffer();
      const workbook = read(arrayBuffer);
      
      console.log('LLM analysis file loaded. Sheet names:', workbook.SheetNames);
      
      // Find the notes sheet - try multiple possible names
      const possibleNotesSheetNames = ['What Students Are Saying', 'Notes', 'Student Notes', 'What Students are Saying'];
      let notesSheet = null;
      let notesSheetName = '';
      
      for (const sheetName of possibleNotesSheetNames) {
        if (workbook.Sheets[sheetName]) {
          notesSheet = workbook.Sheets[sheetName];
          notesSheetName = sheetName;
          break;
        }
      }
      
      if (!notesSheet) {
        throw new Error(`Notes sheet not found. Available sheets: ${workbook.SheetNames.join(', ')}`);
      }
      
      console.log(`Found notes sheet: "${notesSheetName}"`);
      
      const notesData = utils.sheet_to_json(notesSheet, { 
        defval: null,
        raw: false
      });
      
      // Fix null values in notes data
      const fixedNotesData = notesData.map(row => {
        const fixedRow: Record<string, unknown> = {};
        Object.keys(row as Record<string, unknown>).forEach(key => {
          fixedRow[key] = (row as any)[key] === null ? '' : (row as any)[key];
        });
        return fixedRow;
      });
      
      // Find the transcript sheet - try multiple possible names
      const possibleTranscriptSheetNames = ['Transcript', 'transcript', 'Sheet1', 'Data'];
      let transcriptSheet = null;
      let transcriptSheetName = '';
      
      for (const sheetName of possibleTranscriptSheetNames) {
        if (workbook.Sheets[sheetName]) {
          transcriptSheet = workbook.Sheets[sheetName];
          transcriptSheetName = sheetName;
          break;
        }
      }
      
      if (!transcriptSheet) {
        // If no transcript sheet found, try the first sheet that isn't the notes sheet
        const firstNonNotesSheet = workbook.SheetNames.find(name => name !== notesSheetName);
        if (firstNonNotesSheet) {
          transcriptSheet = workbook.Sheets[firstNonNotesSheet];
          transcriptSheetName = firstNonNotesSheet;
          console.log(`Using sheet "${firstNonNotesSheet}" as transcript sheet`);
        } else {
          throw new Error(`Transcript sheet not found. Available sheets: ${workbook.SheetNames.join(', ')}`);
        }
      } else {
        console.log(`Found transcript sheet: "${transcriptSheetName}"`);
      }
      
      const transcriptData = utils.sheet_to_json(transcriptSheet, { 
        defval: null,
        raw: false
      });
      
      console.log('LLM analysis notes data:', notesData.slice(0, 3));
      console.log('LLM analysis transcript data:', transcriptData.slice(0, 3));
      
      setLlmAnalysisData({
        notes: fixedNotesData as Record<string, unknown>[],
        transcript: transcriptData as Record<string, unknown>[]
      });
      setShowLLMAnalysisComparison(true);
      
    } catch (error) {
      console.error('Error loading LLM analysis annotations:', error);
      alert('Failed to load LLM analysis annotations. Please check if transcript_analysis.xlsx exists in the transcript folder.');
    }
  };

  // Handle Unified Comparison (combines both Expert and LLM Analysis)
  const handleUnifiedComparison = async () => {
    try {
      console.log('Loading unified comparison data...');
      
      // Load Expert data
      let expertsData = null;
      try {
        const expertsResponse = await fetch(`/t${number}/expert_annotations.xlsx`);
        if (expertsResponse.ok) {
          const expertsArrayBuffer = await expertsResponse.arrayBuffer();
          const expertsWorkbook = read(expertsArrayBuffer);
          
          // Find notes sheet
          const possibleNotesSheetNames = ['What Students Are Saying', 'Notes', 'Student Notes', 'What Students are Saying'];
          let notesSheet = null;
          let notesSheetName = '';
          
          for (const sheetName of possibleNotesSheetNames) {
            if (expertsWorkbook.Sheets[sheetName]) {
              notesSheet = expertsWorkbook.Sheets[sheetName];
              notesSheetName = sheetName;
              break;
            }
          }
          
          if (!notesSheet) {
            const firstNonTranscriptSheet = expertsWorkbook.SheetNames.find(name => 
              !name.toLowerCase().includes('annotated') && !name.toLowerCase().includes('transcript')
            );
            if (firstNonTranscriptSheet) {
              notesSheet = expertsWorkbook.Sheets[firstNonTranscriptSheet];
              notesSheetName = firstNonTranscriptSheet;
            }
          }
          
          if (notesSheet) {
            const notesData = utils.sheet_to_json(notesSheet, { defval: null, raw: false });
            const fixedNotesData = notesData.map(row => {
              const fixedRow: Record<string, unknown> = {};
              if (row && typeof row === 'object') {
                for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
                  if (key === 'Expert 1.1') {
                    fixedRow['Expert 1'] = value;
                  } else if (key === 'Expert 2.1') {
                    fixedRow['Expert 2'] = value;
                  } else if (key === 'Expert 3.1') {
                    fixedRow['Expert 3'] = value;
                  } else {
                    fixedRow[key] = value;
                  }
                }
              }
              return fixedRow;
            });
            
            // Find the transcript sheet
            const possibleTranscriptSheetNames = ['Annotated Transcript', 'Transcript', 'Annotations', 'Annotated transcript'];
            let transcriptSheet = null;
            let transcriptSheetName = '';
            
            for (const sheetName of possibleTranscriptSheetNames) {
              if (expertsWorkbook.Sheets[sheetName]) {
                transcriptSheet = expertsWorkbook.Sheets[sheetName];
                transcriptSheetName = sheetName;
                break;
              }
            }
            
            if (!transcriptSheet) {
              const firstNonNotesSheet = expertsWorkbook.SheetNames.find(name => name !== notesSheetName);
              if (firstNonNotesSheet) {
                transcriptSheet = expertsWorkbook.Sheets[firstNonNotesSheet];
                transcriptSheetName = firstNonNotesSheet;
              }
            }
            
            const transcriptData = transcriptSheet ? utils.sheet_to_json(transcriptSheet, { defval: null, raw: false }) : [];
            
            expertsData = {
              notes: fixedNotesData as Record<string, unknown>[],
              transcript: transcriptData as Record<string, unknown>[]
            };
            console.log('Expert data loaded successfully');
          }
        }
      } catch (error) {
        console.log('Expert data not available:', error);
      }
      
      // Load LLM Analysis data
      let llmData = null;
      try {
        const llmResponse = await fetch(`/t${number}/transcript_analysis.xlsx`);
        if (llmResponse.ok) {
          const llmArrayBuffer = await llmResponse.arrayBuffer();
          const llmWorkbook = read(llmArrayBuffer);
          
          // Find notes sheet
          const possibleNotesSheetNames = ['What Students Are Saying', 'Notes', 'Student Notes', 'What Students are Saying'];
          let notesSheet = null;
          let notesSheetName = '';
          
          for (const sheetName of possibleNotesSheetNames) {
            if (llmWorkbook.Sheets[sheetName]) {
              notesSheet = llmWorkbook.Sheets[sheetName];
              notesSheetName = sheetName;
              break;
            }
          }
          
          if (notesSheet) {
            const notesData = utils.sheet_to_json(notesSheet, { defval: null, raw: false });
            const fixedNotesData = notesData.map(row => {
              const fixedRow: Record<string, unknown> = {};
              Object.keys(row as Record<string, unknown>).forEach(key => {
                fixedRow[key] = (row as any)[key] === null ? '' : (row as any)[key];
              });
              return fixedRow;
            });
            
            // Find the transcript sheet
            const possibleTranscriptSheetNames = ['Transcript', 'transcript', 'Sheet1', 'Data'];
            let transcriptSheet = null;
            let transcriptSheetName = '';
            
            for (const sheetName of possibleTranscriptSheetNames) {
              if (llmWorkbook.Sheets[sheetName]) {
                transcriptSheet = llmWorkbook.Sheets[sheetName];
                transcriptSheetName = sheetName;
                break;
              }
            }
            
            if (!transcriptSheet) {
              const firstNonNotesSheet = llmWorkbook.SheetNames.find(name => name !== notesSheetName);
              if (firstNonNotesSheet) {
                transcriptSheet = llmWorkbook.Sheets[firstNonNotesSheet];
                transcriptSheetName = firstNonNotesSheet;
              }
            }
            
            const transcriptData = transcriptSheet ? utils.sheet_to_json(transcriptSheet, { defval: null, raw: false }) : [];
            
            llmData = {
              notes: fixedNotesData as Record<string, unknown>[],
              transcript: transcriptData as Record<string, unknown>[]
            };
            console.log('LLM data loaded successfully');
          }
        }
      } catch (error) {
        console.log('LLM data not available:', error);
      }
      
      // Check if at least one data source is available
      if (!expertsData && !llmData) {
        alert('No comparison data available. Please ensure expert_annotations.xlsx or transcript_analysis.xlsx exists in the transcript folder.');
        return;
      }
      
      setExpertsAnnotationData(expertsData);
      setLlmAnalysisData(llmData);
      setShowUnifiedComparison(true);
      
    } catch (error) {
      console.error('Error loading unified comparison data:', error);
      alert('Failed to load comparison data. Please check the file availability.');
    }
  };

  // Optimize feature change handler with batched updates
  const handleFeatureChange = React.useCallback((lineNumber: number, code: string, value: boolean) => {
    setAnnotationData(prev => {
      if (!prev) return prev;
      
      // Find which category this code belongs to
      let targetCategory = null;
      for (const category of ALLOWED_SHEETS) {
        if (prev[category]?.codes.includes(code)) {
          targetCategory = category;
          break;
        }
      }
      
      if (!targetCategory) return prev;
      
      const currentSheet = prev[targetCategory];
      if (!currentSheet) return prev;

      const currentAnnotations = currentSheet.annotations[lineNumber];
      if (currentAnnotations?.[code] === value) return prev;

      return {
        ...prev,
        [targetCategory]: {
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
  }, [annotationData]);

  const [showOnlyStudent, setShowOnlyStudent] = useState(false);
  const [isNotesPanelCollapsed, setIsNotesPanelCollapsed] = useState(false);
  const [showPromptPopup, setShowPromptPopup] = useState(false);
  const [selectedNotePopup, setSelectedNotePopup] = useState<{
    note: Note;
    noteRows: TableRow[];
  } | null>(null);
  const [isNoteInEditMode, setIsNoteInEditMode] = useState(false);
  const [noteEditBuffer, setNoteEditBuffer] = useState<{
    title: string;
    content_1: string;
    content_2: string;
  } | null>(null);

  // Fix hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Add useEffect for handling click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (learningGoalNotePopup && !(event.target as Element).closest('.learning-goal-popup')) {
        setLearningGoalNotePopup(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [learningGoalNotePopup]);

  // Add state for tracking duplicate title validation
  const [titleValidationError, setTitleValidationError] = useState<string>('');

  // Function to check if a title already exists (excluding the current note)
  const checkTitleExists = (title: string, currentNoteId?: number): boolean => {
    const trimmedTitle = title.trim().toLowerCase();
    if (trimmedTitle === '') return false;
    
    return notes.some(note => 
      note.id !== currentNoteId && 
      note.title.trim().toLowerCase() === trimmedTitle
    );
  };

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4 text-black">Loading Transcript...</h1>
          <div className="animate-pulse text-gray-500">Please wait...</div>
              </div>
            </div>
    );
  }

  // Show LLM comparison view if requested
  if (showLLMComparison) {
    return (
      <LLMComparisonView 
        number={number}
        tableData={tableData}
        humanAnnotations={annotationData}
        llmAnnotations={llmAnnotationData}
        onBack={() => setShowLLMComparison(false)}
        speakerColors={speakerColors}
        whichSegment={whichSegment}
      />
    );
  }

  // Show LLM Analysis comparison view if requested
  if (showLLMAnalysisComparison) {
    return (
      <LLMAnalysisComparisonView 
        number={number}
        tableData={tableData}
        userNotes={notes}
        llmAnalysisData={llmAnalysisData}
        onBack={() => setShowLLMAnalysisComparison(false)}
        speakerColors={speakerColors}
        whichSegment={whichSegment}
      />
    );
  }

  // Show Experts comparison view if requested
  if (showExpertsComparison) {
    return (
      <ExpertsComparisonView 
        number={number}
        tableData={tableData}
        userNotes={notes}
        expertsData={expertsAnnotationData}
        onBack={() => setShowExpertsComparison(false)}
        speakerColors={speakerColors}
        whichSegment={whichSegment}
      />
    );
  }

  // Show Unified comparison view if requested
  if (showUnifiedComparison) {
    return (
      <UnifiedComparisonView 
        number={number}
        tableData={tableData}
        userNotes={notes}
        expertsData={expertsAnnotationData}
        llmAnalysisData={llmAnalysisData}
        onBack={() => setShowUnifiedComparison(false)}
        speakerColors={speakerColors}
        whichSegment={whichSegment}
      />
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen w-full bg-white font-merriweather text-sm">
      {/* Navigation button - fixed in top left corner */}
      <button
        onClick={() => router.push("/")}
        className="fixed top-4 left-4 z-50 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors shadow-lg flex items-center gap-2"
        title="Back to Transcript Selection"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
        Home
      </button>
      
      {/* Header area with title */}
      <div className="w-full max-w-6xl p-4 mb-4">
        <div className="bg-gray-100 border rounded-lg p-4 mb-4">
          <div className="flex justify-between items-start mb-3">
            <h1 className="text-xl text-gray-800 font-semibold">
              {gradeLevel}
        </h1>
            <button
              onClick={() => setShowLessonGoal(!showLessonGoal)}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md transition-colors flex items-center gap-1"
              title={showLessonGoal ? "Hide lesson details" : "Show lesson details"}
            >
              {showLessonGoal ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/>
                  </svg>
                  Hide
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>
                  </svg>
                  Show
                </>
            )}
            </button>
        </div>
          
          {showLessonGoal && (
            <>
              {lessonGoal && (
                <div>
                  <h2 className="text-lg text-gray-800 font-medium mb-2">Lesson Goal:</h2>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                    {lessonGoal}
                  </p>
                </div>
              )}
            </>
          )}
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
          <button
          onClick={() => handleSegmentClick('student_only')}
          className={`px-3 py-1 rounded-md text-sm text-white mr-2 ${
            whichSegment === 'student_only' ? 'bg-green-500 hover:bg-green-700' : 'bg-gray-400'
            }`}
        >
          student_only
          </button>
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
        <div className="p-4 flex flex-col" style={{ 
          width: showPromptPanel ? centerPanelWidth : '100%'
        }}>
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
            {isCreatingNote ? (
              <div className="border border-gray-300 rounded-md bg-gray-100 p-4 my-3 max-w-md">
                <span className="mr-2 text-sm text-black italic">Select rows that provide <b className="font-bold">sufficient evidence</b> to allow you to assess and/or advance their understanding toward the lesson goals. </span>
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
                <span className="mr-2 text-sm">Editing lines for learning goal note #{editingLinesId}</span>
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
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCompareWithLLM}
                  className="px-3 py-1 bg-purple-500 text-white rounded-md hover:bg-purple-700 text-sm"
                >
                  Compare Talk Features
                </button>
                <button
                  onClick={handleUnifiedComparison}
                  className="px-3 py-1 bg-indigo-500 text-white rounded-md hover:bg-indigo-700 text-sm"
                >
                  Compare Learning Notes
                </button>
              </div>
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
                <div className="text-sm text-gray-600 italic">
                  Click on feature columns to see code definitions
                </div>
              </div>
            </div>

            {/* Search Box */}
            <div className="flex items-center justify-center gap-2 py-3 border-t border-gray-200">
              <span className="text-sm text-gray-600">Search:</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search utterances or enter line number..."
                  className="px-3 py-1 border border-gray-300 rounded text-sm w-80"
                />
                {searchMatches.length > 0 && (
                  <>
                    <span className="text-sm text-gray-600">
                      {currentSearchMatch + 1} of {searchMatches.length}
                    </span>
                  <button
                      onClick={() => navigateSearch('prev')}
                      className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                      title="Previous match"
                    >
                      ↑
              </button>
                <button
                      onClick={() => navigateSearch('next')}
                      className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                      title="Next match"
                    >
                      ↓
                </button>
                  </>
                )}
                {searchTerm && (
                  <button
                    onClick={clearSearch}
                    className="px-2 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
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
                      <th className={`px-2 py-2 border border-black border-2 text-sm ${columnVisibility.notes ? 'w-24' : 'w-12'}`}>
                          <button
                            onClick={() => setShowPromptPopup(true)}
                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-sm font-medium"
                            title="Click to view annotation prompt"
                          >
                            Learning Goal Notes
                          </button>
                      </th>
                    )}

                    {/* Feature Columns */}
                    {ALLOWED_SHEETS.map(category => (
                      <th 
                        key={category} 
                        className="px-2 py-2 border border-black border-2 text-sm w-20 text-center cursor-pointer hover:bg-blue-50"
                        onClick={() => setShowFeatureOverview(category)}
                        title={`Click to see all ${category} features and definitions`}
                      >
                        <div className="text-sky-600 font-medium hover:text-sky-800">
                          {category}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTableData.map((rowData, index) => (
                    <TableRow
                      key={`${rowData.col2}-${index}`}
                      rowData={rowData}
                      rowIndex={index}
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

        {/* Right panel removed - all notes functionality moved to popup */}
            </div>
      
      {/* Footer area with buttons */}
      <div className="w-full max-w-6xl p-4 flex flex-col items-center">
        <div className="flex justify-center items-center space-x-8">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-700 transition"
            >
              Save
            </button>
            
            {/* Auto-save status indicator */}
            <div className="flex items-center space-x-2 text-sm">
              {saveStatus === 'saving' && (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                </>
              )}
              {saveStatus === 'unsaved' && (
                <>
                  <div className="h-4 w-4 rounded-full bg-yellow-500"></div>
                </>
              )}
            </div>
          </div>
          


          <button
            onClick={handleExport}
            className="px-6 py-2 bg-green-500 text-white font-semibold rounded-md hover:bg-green-700 transition"
          >
            Export to Excel
          </button>

          <button
            onClick={handleUploadToCloud}
            disabled={uploadStatus === 'uploading'}
            className={`px-6 py-2 font-semibold rounded-md transition flex items-center space-x-2 ${
              uploadStatus === 'uploading'
                ? 'bg-blue-300 text-white cursor-not-allowed'
                : uploadStatus === 'success'
                ? 'bg-green-600 text-white'
                : uploadStatus === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-blue-500 text-white hover:bg-blue-700'
            }`}
          >
            {uploadStatus === 'uploading' && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            <span>
              {uploadStatus === 'uploading'
                ? 'Uploading...'
                : uploadStatus === 'success'
                ? 'Uploaded!'
                : uploadStatus === 'error'
                ? 'Upload Failed'
                : 'Upload to Cloud'}
            </span>
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

      {/* Feature Overview Popup */}
      {showFeatureOverview && annotationData?.[showFeatureOverview] && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowFeatureOverview(null)}
        >
          <div 
            className="bg-white border-2 border-gray-800 rounded-lg shadow-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                {showFeatureOverview} Features & Definitions
              </h2>
              <button
                onClick={() => setShowFeatureOverview(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                title="Close"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              {annotationData[showFeatureOverview].codes.map((code: string) => {
                const definition = annotationData[showFeatureOverview].definitions[code];
                return (
                  <div key={code} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-blue-700 mb-2">{code}</h3>
                    
                    {definition && (
                      <>
                        <div className="mb-3">
                          <h4 className="font-medium text-gray-800 mb-1">Definition:</h4>
                          <p className="text-gray-700">{definition.Definition || 'No definition available'}</p>
                        </div>
                        
                        {definition.example1 && (
                          <div className="mb-3">
                            <h4 className="font-medium text-green-800 mb-1">Example:</h4>
                            <p className="text-green-700 italic">{definition.example1}</p>
                          </div>
                        )}
                        
                        {definition.example2 && (
                          <div className="mb-3">
                            <h4 className="font-medium text-green-800 mb-1">Example 2:</h4>
                            <p className="text-green-700 italic">{definition.example2}</p>
                          </div>
                        )}
                        
                        {definition.nonexample1 && (
                          <div className="mb-3">
                            <h4 className="font-medium text-red-800 mb-1">Non-example:</h4>
                            <p className="text-red-700 italic">{definition.nonexample1}</p>
                          </div>
                        )}
                        
                        {definition.nonexample2 && (
                          <div className="mb-3">
                            <h4 className="font-medium text-red-800 mb-1">Non-example 2:</h4>
                            <p className="text-red-700 italic">{definition.nonexample2}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Note Content Popup */}
      {selectedNotePopup && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedNotePopup(null)}
        >
          <div 
            className="bg-white border-2 border-gray-800 rounded-lg shadow-lg max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-white rounded-t-lg flex-shrink-0">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-2">
                  <div className="flex items-center gap-1">
                  <h1 className="text-xl text-gray-800 font-semibold">
                      Learning Goal Note :
                  </h1>
                    <div className="flex-1">
                        <input
                          type="text"
                        value={isNoteInEditMode ? (noteEditBuffer?.title || '') : selectedNotePopup.note.title}
                        onChange={(e) => {
                          const newTitle = e.target.value;
                          
                          // Check for duplicate titles
                          if (checkTitleExists(newTitle, selectedNotePopup.note.id)) {
                            setTitleValidationError('This title already exists. Please choose a different name.');
                          } else {
                            setTitleValidationError('');
                          }
                          
                          if (isNoteInEditMode) {
                            setNoteEditBuffer(prev => prev ? {...prev, title: newTitle} : null);
                          } else {
                            // Update the note directly when not in edit mode
                            const updatedNotes = notes.map(note => 
                              note.id === selectedNotePopup.note.id 
                                ? {...note, title: newTitle}
                                : note
                            );
                            setNotes(updatedNotes);
                            setSelectedNotePopup({
                              ...selectedNotePopup,
                              note: {...selectedNotePopup.note, title: newTitle}
                            });
                          }
                        }}
                        className={`text-xl text-blue-600 font-medium border focus:outline-none bg-white p-1 rounded flex-1 ${
                          titleValidationError 
                            ? 'border-red-500 focus:border-red-500' 
                            : 'border-blue-300 focus:border-blue-500'
                        }`}
                        placeholder="Enter note title..."
                      />
                      {titleValidationError && (
                        <div className="text-red-500 text-xs mt-1">{titleValidationError}</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <p>Lines: {selectedNotePopup.note.rowIndices.map(idx => tableData[idx]?.col2).join(', ')}</p>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this note?')) {
                        handleDeleteNote(selectedNotePopup.note.id);
                        setSelectedNotePopup(null);
                      }
                    }}
                    className="text-red-500 hover:text-red-700"
                    title="Delete this note"
                  >
                    🗑 Delete this Note
                  </button>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2 ml-4">
                    <button
                  onClick={() => {
                    if (!titleValidationError) {
                      setSelectedNotePopup(null);
                      setTitleValidationError('');
                    }
                  }}
                  disabled={titleValidationError !== ''}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    titleValidationError 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                  title={titleValidationError ? 'Please fix the title error before saving' : 'Save and close'}
                    >
                  Save & Close
                    </button>
                <button
                  onClick={() => {
                    setSelectedNotePopup(null);
                    setTitleValidationError('');
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl leading-none flex-shrink-0"
                  title="Close"
                >
                  ×
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* Evidence */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h3 className="font-semibold text-gray-800 mb-3">Evidence from Transcript:</h3>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {selectedNotePopup.noteRows.map((row, rowIdx) => (
                    <div key={rowIdx} className="pb-3 border-b border-gray-200 last:border-b-0">
                      <p className="text-sm text-gray-800 mb-1">{row.col6}</p>
                      <p className="text-xs text-gray-500">Line {row.col2} • {row.col5}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Question 1 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">
                  Q1: What are students saying in the selected piece(s) of evidence?
                </h3>
                  <textarea
                  value={selectedNotePopup.note.content_1 || ''}
                  onChange={(e) => {
                    const updatedNotes = notes.map(note => 
                      note.id === selectedNotePopup.note.id 
                        ? {...note, content_1: e.target.value}
                        : note
                    );
                    setNotes(updatedNotes);
                    setSelectedNotePopup({
                      ...selectedNotePopup,
                      note: {...selectedNotePopup.note, content_1: e.target.value}
                    });
                  }}
                    rows={4}
                    className="w-full p-3 border border-gray-300 rounded focus:border-blue-500 focus:outline-none resize-y text-sm text-gray-800"
                    placeholder="Type your response here..."
                  />
              </div>

              {/* Question 2 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">
                  Q2: What does this piece of evidence(s) tell you about students' understanding and/or progress toward the lesson's goals?
                </h3>
                  <textarea
                  value={selectedNotePopup.note.content_2 || ''}
                  onChange={(e) => {
                    const updatedNotes = notes.map(note => 
                      note.id === selectedNotePopup.note.id 
                        ? {...note, content_2: e.target.value}
                        : note
                    );
                    setNotes(updatedNotes);
                    setSelectedNotePopup({
                      ...selectedNotePopup,
                      note: {...selectedNotePopup.note, content_2: e.target.value}
                    });
                  }}
                    rows={5}
                    className="w-full p-3 border border-gray-300 rounded focus:border-blue-500 focus:outline-none resize-y text-sm text-gray-800"
                    placeholder="Type your response here..."
                  />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Popup */}
      {showPromptPopup && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4"
          onClick={() => setShowPromptPopup(false)}
        >
          <div 
            className="bg-white border-2 border-gray-800 rounded-lg shadow-lg max-w-4xl w-full max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col mt-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-white rounded-t-lg flex-shrink-0">
              <h1 className="text-2xl text-gray-800 font-semibold">
                Prompt:
              </h1>
              <button
                onClick={() => setShowPromptPopup(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none flex-shrink-0"
                title="Close"
              >
                ×
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 p-6">
              <h2 className="text-xl text-gray-800">
                <div>
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <strong>Note:</strong> Only focal student dialogue where the teacher is not present is eligible
                  </div>
                  Consider the goals for this lesson. What do you notice about what students say that would help you{" "}
                  <strong>assess and/or advance</strong> their understanding toward those goals?<i>
                  (Select rows that provide sufficient evidence to allow you to{" "}
                  <strong>assess and/or advance</strong> their understanding toward the lesson goals.)</i>
                  <br /> <br></br>
                  In your notes, please answer the following two questions:<br />
                  1. What are students saying in the selected piece(s) of evidence?<br />
                  2. What does this piece of evidence(s) tell you about students' understanding and/or progress toward the lesson's goals?
                </div>
              </h2>
            </div>
          </div>
        </div>
      )}

      {learningGoalNotePopup && (
        <div 
          className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4 learning-goal-popup"
          style={{
            left: learningGoalNotePopup.position.x,
            top: learningGoalNotePopup.position.y,
            minWidth: '250px',
            maxHeight: '300px'
          }}
        >
          {learningGoalNotePopup.mode === 'initial' && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  handleCreateNoteWithRows([learningGoalNotePopup.rowIndex]);
                  setLearningGoalNotePopup(null);
                }}
                className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center gap-2"
              >
                <span>+</span>
                <span>Create New Learning Goal Note</span>
              </button>
              
              {notes.length > 0 && (
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="text-sm font-medium text-gray-700 mb-2">Assign to Existing Note:</div>
                  <div className="max-h-48 overflow-y-auto">
                    {notes.map(note => {
                      const rowIndex = learningGoalNotePopup.rowIndex;
                      const isAssigned = note.rowIndices.includes(rowIndex);
                      
                      return (
                        <div 
                          key={note.id}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                          onClick={() => {
                            const updatedNotes = [...notes];
                            const noteIndex = updatedNotes.findIndex(n => n.id === note.id);
                            if (noteIndex !== -1) {
                              if (isAssigned) {
                                // Remove from note
                                updatedNotes[noteIndex].rowIndices = updatedNotes[noteIndex].rowIndices.filter(idx => idx !== rowIndex);
                                
                                // Update table data
                                const updatedTableData = [...tableData];
                                const currentIds = parseNoteIds(updatedTableData[rowIndex].noteIds);
                                updatedTableData[rowIndex].noteIds = currentIds.filter(id => id !== note.id).join(', ');
                                setTableData(updatedTableData);
                              } else {
                                // Add to note
                                updatedNotes[noteIndex].rowIndices.push(rowIndex);
                                
                                // Update table data
                                const updatedTableData = [...tableData];
                                const currentIds = parseNoteIds(updatedTableData[rowIndex].noteIds);
                                updatedTableData[rowIndex].noteIds = [...currentIds, note.id].join(', ');
                                setTableData(updatedTableData);
                              }
                              setNotes(updatedNotes);
                            }
                          }}
                        >
                          <div className={`w-4 h-4 rounded border ${isAssigned ? 'bg-blue-500 border-blue-500' : 'border-gray-300'} flex items-center justify-center`}>
                            {isAssigned && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm text-gray-700 flex-1">{note.title || `Note ${note.id}`}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <button
                onClick={() => setLearningGoalNotePopup(null)}
                className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 mt-2"
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}