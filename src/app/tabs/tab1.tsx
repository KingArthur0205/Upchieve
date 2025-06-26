"use client"; // Client Component

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";

interface Tab1Props {
  number: string | undefined;
  selectedSegment: string | undefined;
}

interface ImageData {
  url: string;
  filename: string;
  uploadedAt: string;
  originalName: string;
}

export default function Tab1({ number, selectedSegment }: Tab1Props) {
  const [lessonLink, setLessonLink] = useState<{ url: string; text: string } | null>(null);
  const [images, setImages] = useState<ImageData[]>([]);
  const [legacyImages, setLegacyImages] = useState<string[]>([]);
  const [lessonSegmentIDs, setLessonSegmentIDs] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  const loadImages = useCallback(async () => {
    if (!number) return;
    
    try {
      const response = await fetch(`/t${number}/images.json`);
      const data = await response.json();
      
      // Handle both old format and new format
      if (data.images && Array.isArray(data.images)) {
        // New format with images array
        setImages(data.images);
        setLegacyImages([]);
      } else if (data[`t${number}`] && Array.isArray(data[`t${number}`])) {
        // Old format with transcript-specific array
        setLegacyImages(data[`t${number}`]);
        setImages([]);
      } else {
        // No images
        setImages([]);
        setLegacyImages([]);
      }
      
      setLessonSegmentIDs(data.segments || []);
    } catch (err) {
      console.error("Error loading images:", err);
      setImages([]);
      setLegacyImages([]);
    }
  }, [number]);

  useEffect(() => {
    if (!number || !selectedSegment) return;

    // Fetch lesson link from content.json
    fetch(`/t${number}/content.json`)
      .then((res) => res.json())
      .then((data) => {
        setLessonLink(data.lessonLink);
      })
      .catch((err) => console.error("Error loading content:", err));

    // Load images
    loadImages();
  }, [number, selectedSegment, loadImages]);

  const handleImageUpload = async (file: File) => {
    if (!number) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadStatus({
        type: 'error',
        message: 'Please select an image file (JPEG, PNG, GIF, WebP)'
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setUploadStatus({
        type: 'error',
        message: 'File size must be less than 5MB'
      });
      return;
    }

    setIsUploading(true);
    setUploadStatus({ type: null, message: '' });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('transcriptId', `t${number}`);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setUploadStatus({
          type: 'success',
          message: 'Image uploaded successfully!'
        });
        
        // Reload images
        await loadImages();
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setUploadStatus({ type: null, message: '' });
        }, 3000);
      } else {
        setUploadStatus({
          type: 'error',
          message: result.error || 'Upload failed'
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({
        type: 'error',
        message: 'Failed to upload image. Please try again.'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleImageUpload(files[0]);
    }
  }, []);

  const handleDeleteImage = async (index: number, image: { isLegacy?: boolean; filename?: string; originalName?: string }) => {
    if (!number) return;
    
    if (!confirm(`Are you sure you want to delete "${image.originalName || `Image ${index + 1}`}"?`)) {
      return;
    }
    
    setDeletingIndex(index);
    
    try {
      const response = await fetch('/api/delete-image', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcriptId: `t${number}`,
          filename: image.isLegacy ? undefined : image.filename,
          imageIndex: index
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setUploadStatus({
          type: 'success',
          message: 'Image deleted successfully!'
        });
        
        // Reload images
        await loadImages();
        
        setTimeout(() => {
          setUploadStatus({ type: null, message: '' });
        }, 3000);
      } else {
        setUploadStatus({
          type: 'error',
          message: result.error || 'Failed to delete image'
        });
      }
    } catch (error) {
      console.error('Delete error:', error);
      setUploadStatus({
        type: 'error',
        message: 'Failed to delete image. Please try again.'
      });
    } finally {
      setDeletingIndex(null);
    }
  };



  // Combine legacy images and new images for display
  const allImages = [
    ...legacyImages.map((url, index) => ({
      url,
      filename: `legacy_image_${index}.jpg`,
      uploadedAt: '',
      originalName: `Image ${index + 1}`,
      isLegacy: true
    })),
    ...images.map(img => ({ ...img, isLegacy: false }))
  ];

  return (
    <div className="h-[80vh] overflow-y-auto p-6 border border-gray-300 rounded-md">
      <h2 className="text-xl font-semibold text-black mb-4">
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
      
      {/* Display Images */}
      {allImages.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-800">Images</h3>
            <p className="text-sm text-gray-500">Hover over images to delete</p>
          </div>
          <div className="space-y-6 mb-6">
            {allImages.map((image, index) => {
            const segmentID = lessonSegmentIDs[index];

            // Check if the image should be displayed
            if (selectedSegment === "full_transcript" || selectedSegment === "student_only" || segmentID === selectedSegment) {
              return (
                <div 
                  key={index} 
                  className="text-center relative group rounded-lg p-4"
                >

                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteImage(index, image)}
                    disabled={deletingIndex === index}
                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    title="Delete image"
                  >
                    {deletingIndex === index ? (
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>

                  <h3 className="text-lg font-semibold text-black mb-2">
                    Problem #{index + 1}
                    {segmentID && ` (Lesson Segment ID: ${segmentID})`}
                  </h3>
                  <div className="relative inline-block">
                    <Image 
                      src={image.url} 
                      alt={`Problem ${index + 1}`} 
                      width={500} 
                      height={300}
                      className="rounded-lg shadow-md"
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    {image.originalName}
                  </p>
                </div>
              );
            }
            return null;
          })}
          </div>
        </div>
      ) : (
        <div className="text-center mb-6 p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <svg className="mx-auto w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500 text-lg mb-2">No images yet</p>
          <p className="text-gray-400 text-sm">Use the &quot;Add Image&quot; button below to upload images</p>
        </div>
      )}

      {/* Image Upload Section - Moved to bottom */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border-t border-gray-200">
        <h3 className="text-lg font-medium text-gray-800 mb-3">Add New Image</h3>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="image-upload"
            disabled={isUploading}
          />
          <label
            htmlFor="image-upload"
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md cursor-pointer transition-colors ${
              isUploading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isUploading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading...
              </>
            ) : (
              'Add Image'
            )}
          </label>
          <span className="text-sm text-gray-500">
            Supports: JPEG, PNG, GIF, WebP (max 5MB)
          </span>
        </div>
        
        {/* Upload Status */}
        {uploadStatus.type && (
          <div className={`mt-3 p-3 rounded-md ${
            uploadStatus.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <div className="flex items-center">
              {uploadStatus.type === 'success' ? (
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span className="text-sm font-medium">{uploadStatus.message}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}