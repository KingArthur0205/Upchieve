"use client";

import { useState, useEffect, useRef } from 'react';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Settings({ isOpen, onClose }: SettingsProps) {
  const [googleCredentialsBase64, setGoogleCredentialsBase64] = useState('');
  const [googleCloudBucketName, setGoogleCloudBucketName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showEnvModal, setShowEnvModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load current settings when component opens
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close if the modal is open
      if (showEnvModal) {
        return;
      }
      
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, showEnvModal]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/save-settings');
      const data = await response.json();
      
      if (data.success) {
        setGoogleCredentialsBase64(data.settings.googleCredentialsBase64 || '');
        setGoogleCloudBucketName(data.settings.googleCloudBucketName || '');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage('Error loading current settings');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowEnvModal(false);
    setMessage('');
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage('');
    
    try {
      const response = await fetch('/api/save-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          googleCredentialsBase64,
          googleCloudBucketName,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage('Settings saved successfully!');
        setTimeout(() => {
          setMessage('');
          setShowEnvModal(false);
          onClose();
        }, 2000);
      } else {
        setMessage('Error saving settings: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Settings Dropdown */}
      <div 
        ref={dropdownRef}
        className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 min-w-64 z-50"
      >
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Settings</h3>
          
          <div className="space-y-2">
            <button
              onClick={() => setShowEnvModal(true)}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
              </svg>
              Configure Google Cloud
            </button>
          </div>
        </div>
      </div>

      {/* Environment Variables Modal */}
      {showEnvModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]"
          onClick={handleCloseModal}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Configure Google Cloud</h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {loading ? (
                <div className="text-center py-4">
                  <div className="text-gray-600">Loading settings...</div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Google Credentials (Base64)
                    </label>
                    <textarea
                      value={googleCredentialsBase64}
                      onChange={(e) => setGoogleCredentialsBase64(e.target.value)}
                      placeholder="Paste your base64-encoded Google service account credentials here..."
                      className="w-full h-32 p-3 border border-gray-300 rounded-md resize-vertical focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This should be your Google service account JSON file encoded in base64
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Google Cloud Bucket Name
                    </label>
                    <input
                      type="text"
                      value={googleCloudBucketName}
                      onChange={(e) => setGoogleCloudBucketName(e.target.value)}
                      placeholder="your-bucket-name"
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      The name of your Google Cloud Storage bucket
                    </p>
                  </div>

                  {message && (
                    <div className={`p-3 rounded-md ${
                      message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {message}
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      onClick={handleCloseModal}
                      className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition"
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveSettings}
                      disabled={saving}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:bg-blue-300"
                    >
                      {saving ? 'Saving...' : 'Save to .env.local'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
} 