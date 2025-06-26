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

  useEffect(() => {
    setMounted(true);
    loadTranscripts();
  }, []);

  const handleTranscriptUploaded = () => {
    // Refresh transcript list when a new transcript is uploaded
    loadTranscripts();
  };

  const handleFeatureDefinitionUploaded = () => {
    // Handle feature definition upload success
    console.log('Feature definition uploaded successfully');
    // Could reload feature definitions if needed
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
        <div className="flex justify-center space-x-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {transcripts.map(transcript => (
              <div key={transcript.id} className="relative group">
                <button 
                  onClick={() => router.push(`/transcript/${transcript.id.replace('t', '')}`)}
                  disabled={deletingTranscript === transcript.id}
                  className={`w-full p-4 text-white font-semibold rounded-lg transition shadow-md text-center ${
                    deletingTranscript === transcript.id 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : transcript.isNew 
                        ? 'bg-green-500 hover:bg-green-600' 
                        : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                >
                  <div className={`text-sm mb-1 ${
                    deletingTranscript === transcript.id 
                      ? 'text-gray-200'
                      : transcript.isNew ? 'text-green-100' : 'text-blue-100'
                  }`}>
                    {transcript.id}
                  </div>
                  <div className="text-base">
                    {deletingTranscript === transcript.id ? 'Deleting...' : transcript.displayName}
                  </div>
                </button>
                
                {/* Delete Button */}
                <button
                  onClick={(e) => handleDeleteTranscript(transcript.id, e)}
                  disabled={deletingTranscript === transcript.id}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete transcript"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
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