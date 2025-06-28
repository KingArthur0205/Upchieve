"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import TranscriptUpload from "./components/TranscriptUpload";
import FeatureDefinitionUpload from "./components/FeatureDefinitionUpload";
import FeatureDefinitionsViewer from "./components/FeatureDefinitionsViewer";
import ZipUpload from "./components/ZipUpload";
import Settings from "./components/Settings";

interface TranscriptInfo {
  id: string;
  displayName: string;
  isNew: boolean;
}

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [deletingTranscript, setDeletingTranscript] = useState<string | null>(null);
  const [showFeatureUpload, setShowFeatureUpload] = useState(false);
  const [showFeatureViewer, setShowFeatureViewer] = useState(false);
  const [showZipUpload, setShowZipUpload] = useState(false);
  const [visitedTranscripts, setVisitedTranscripts] = useState<Set<string>>(new Set());


  const loadTranscripts = async () => {
    try {
      const response = await fetch('/api/list-transcripts');
      const data = await response.json();
      
      if (data.success) {
        setTranscripts(data.transcripts);
      }
    } catch (error) {
      console.error('Error loading transcripts:', error);
      // Fallback to hardcoded list if API fails
      setTranscripts([
        { id: "001", displayName: "Transcript 001", isNew: false },
        { id: "044", displayName: "Transcript 044", isNew: false },
        { id: "053", displayName: "Transcript 053", isNew: false },
        { id: "996", displayName: "Transcript 996", isNew: true },
        { id: "997", displayName: "Transcript 997", isNew: true },
        { id: "998", displayName: "Transcript 998", isNew: true },
        { id: "999", displayName: "Transcript 999", isNew: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Load visited transcripts from localStorage
  const loadVisitedTranscripts = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('visitedTranscripts');
      if (stored) {
        try {
          const visitedArray = JSON.parse(stored);
          setVisitedTranscripts(new Set(visitedArray));
        } catch (error) {
          console.error('Error loading visited transcripts:', error);
        }
      }
    }
  };

  // Mark transcript as visited
  const markTranscriptAsVisited = (transcriptId: string) => {
    const newVisited = new Set(visitedTranscripts);
    newVisited.add(transcriptId);
    setVisitedTranscripts(newVisited);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('visitedTranscripts', JSON.stringify(Array.from(newVisited)));
    }
  };

  // Handle transcript click with visit tracking
  const handleTranscriptClick = (transcriptId: string) => {
    markTranscriptAsVisited(transcriptId);
    router.push(`/transcript/${transcriptId.replace('t', '')}`);
  };

  useEffect(() => {
    setMounted(true);
    loadTranscripts();
    loadVisitedTranscripts();
  }, []);

  const handleTranscriptUploaded = () => {
    // Refresh transcript list when a new transcript is uploaded
    loadTranscripts();
  };

  const handleFeatureDefinitionUploaded = () => {
    // Handle feature definition upload success
    console.log('Feature definition uploaded successfully - all annotations cleared');
    
    // Show a notification to the user about the annotation clearing
    alert('Feature definition uploaded successfully!\n\nAll previous annotations have been cleared from all transcripts.\nPlease refresh any open transcript pages to see the new feature definitions.');
  };

  const handleDeleteTranscript = async (transcriptId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent navigation when clicking delete
    
    if (!confirm(`Are you sure you want to delete transcript ${transcriptId}? This action cannot be undone.`)) {
      return;
    }
    
    setDeletingTranscript(transcriptId);
    
    try {
      const response = await fetch('/api/delete-transcript', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcriptId }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh transcript list after successful deletion
        await loadTranscripts();
      } else {
        alert(`Error deleting transcript: ${data.error}`);
      }
    } catch (error) {
      console.error('Error deleting transcript:', error);
      alert('Error deleting transcript');
    } finally {
      setDeletingTranscript(null);
    }
  };



  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <h1 className="text-3xl font-bold mb-8 text-black">Transcript Viewer</h1>
        <div className="flex flex-col space-y-4">
          <div className="px-8 py-3 bg-gray-300 text-gray-500 font-semibold rounded-md w-64 text-center">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  // Separate transcripts by type (keeping for potential future use)
  // const originalTranscripts = transcripts.filter(t => !t.isNew);
  // const newTranscripts = transcripts.filter(t => t.isNew);

  return (
    <div className="min-h-screen bg-white p-8">
      {/* Header with Title and Actions */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-black">Transcript Viewer</h1>
        
        {/* Top Right Actions */}
        <div className="flex items-center gap-3">
          {/* Zip Upload Button */}
          <button
            onClick={() => setShowZipUpload(!showZipUpload)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Upload to Cloud
          </button>

          {/* Settings Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
              <svg className={`w-4 h-4 transition-transform ${showSettings ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Settings Dropdown */}
            {showSettings && (
              <Settings 
                isOpen={showSettings} 
                onClose={() => setShowSettings(false)} 
              />
            )}
          </div>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="mb-8 text-center space-y-4">
        <div className="flex justify-center space-x-4 flex-wrap gap-2">
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="px-6 py-3 bg-green-500 text-white font-semibold rounded-md hover:bg-green-600 transition flex items-center gap-2"
          >
            <span>+</span>
            <span>Add New Transcript</span>
          </button>
          
          <button
            onClick={() => setShowFeatureUpload(!showFeatureUpload)}
            className="px-6 py-3 bg-purple-500 text-white font-semibold rounded-md hover:bg-purple-600 transition flex items-center gap-2"
          >
            <span>+</span>
            <span>Add Feature Definition</span>
          </button>
          
          <button
            onClick={() => setShowFeatureViewer(true)}
            className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-600 transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>View Feature Definitions</span>
          </button>
          

        </div>
      </div>

      {/* Upload Sections */}
      {showUpload && (
        <div className="mb-8 max-w-2xl mx-auto">
          <TranscriptUpload onUploadSuccess={handleTranscriptUploaded} />
        </div>
      )}
      
      {showFeatureUpload && (
        <div className="mb-8 max-w-2xl mx-auto">
          <FeatureDefinitionUpload onUploadSuccess={handleFeatureDefinitionUploaded} />
        </div>
      )}
      
      {showZipUpload && (
        <div className="mb-8 max-w-2xl mx-auto">
          <ZipUpload transcripts={transcripts} onUploadSuccess={() => console.log('Zip uploaded successfully')} />
        </div>
      )}

      {/* Transcripts Grid */}
      <div className="max-w-6xl mx-auto">
        <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">Available Transcripts</h2>
        
        {loading ? (
          <div className="text-center">
            <div className="inline-block px-8 py-3 bg-gray-300 text-gray-500 font-semibold rounded-md">
              Loading transcripts...
            </div>
          </div>
        ) : transcripts.length === 0 ? (
          <div className="text-center">
            <div className="inline-block px-8 py-3 bg-gray-100 text-gray-600 font-medium rounded-md">
              No transcripts available
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {transcripts.map((transcript, index) => {
              // Create a diverse color palette for each transcript
              const colorVariants = [
                'from-blue-500 via-purple-500 to-indigo-600',
                'from-emerald-400 via-teal-500 to-cyan-600',
                'from-rose-400 via-pink-500 to-purple-600',
                'from-amber-400 via-orange-500 to-red-500',
                'from-violet-500 via-purple-500 to-pink-500',
                'from-green-400 via-emerald-500 to-teal-600',
                'from-blue-600 via-indigo-500 to-purple-600',
                'from-orange-400 via-red-500 to-pink-500',
                'from-cyan-400 via-blue-500 to-indigo-600',
                'from-lime-400 via-green-500 to-emerald-600',
                'from-fuchsia-400 via-purple-500 to-violet-600',
                'from-yellow-400 via-orange-500 to-red-500'
              ];
              
              const gradientClass = colorVariants[index % colorVariants.length];
              
              // Check if this transcript should show the "New" badge
              const isUnvisitedNew = transcript.isNew && !visitedTranscripts.has(transcript.id);
              
              return (
                <div key={transcript.id} className="relative group">
                  <button 
                    onClick={() => handleTranscriptClick(transcript.id)}
                    disabled={deletingTranscript === transcript.id}
                    className={`w-full p-6 text-white font-medium rounded-xl transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:scale-105 text-center relative overflow-hidden ${
                      deletingTranscript === transcript.id 
                        ? 'bg-gray-400 cursor-not-allowed scale-95' 
                        : `bg-gradient-to-br ${gradientClass} hover:shadow-xl`
                    }`}
                  >
                    {/* Background pattern overlay */}
                    <div className="absolute inset-0 bg-white/10 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.1),transparent_50%)]"></div>
                    
                    {/* Content */}
                    <div className="relative z-10">
                      {/* Transcript ID */}
                      <div className="text-xs font-semibold mb-2 opacity-90 tracking-wider uppercase">
                        {transcript.id}
                      </div>
                      
                      {/* Icon */}
                      <div className="mb-3">
                        <svg className="w-8 h-8 mx-auto opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      
                      {/* Display Name */}
                      <div className="text-sm font-medium leading-tight">
                        {deletingTranscript === transcript.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Deleting...
                          </div>
                        ) : (
                          transcript.displayName
                        )}
                      </div>
                      
                      {/* New badge for unvisited new transcripts */}
                      {isUnvisitedNew && !deletingTranscript && (
                        <div className="mt-2">
                          <span className="inline-block px-2 py-1 text-xs font-semibold bg-white/20 rounded-full backdrop-blur-sm">
                            ✨ New
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  </button>
                  
                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDeleteTranscript(transcript.id, e)}
                    disabled={deletingTranscript === transcript.id}
                    className="absolute top-3 right-3 w-7 h-7 bg-red-500/80 backdrop-blur-sm hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110 shadow-lg"
                    title="Delete transcript"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Feature Definitions Viewer */}
      <FeatureDefinitionsViewer 
        isOpen={showFeatureViewer} 
        onClose={() => setShowFeatureViewer(false)} 
      />

    </div>
  );
}