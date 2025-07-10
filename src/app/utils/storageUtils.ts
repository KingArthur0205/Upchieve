// Utility functions for handling chunked transcript data storage
import { saveToIndexedDB, loadFromIndexedDB, removeFromIndexedDB } from './indexedDBUtils';

interface ChunkInfo {
  totalChunks: number;
  totalSize: number;
  chunkSize: number;
}

// Enhanced storage functions with IndexedDB fallback
export async function safeStorageSet(key: string, value: string): Promise<void> {
  try {
    localStorage.setItem(key, value);
  } catch {
    console.warn(`localStorage full, falling back to IndexedDB for ${key}`);
    await saveToIndexedDB(key, value);
  }
}

export async function safeStorageGet(key: string): Promise<string | null> {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) {
      return value;
    }
    // If not in localStorage, check IndexedDB
    return await loadFromIndexedDB(key);
  } catch (error) {
    console.error(`Error retrieving ${key}:`, error);
    return null;
  }
}

export async function safeStorageRemove(key: string): Promise<void> {
  try {
    localStorage.removeItem(key);
    await removeFromIndexedDB(key);
  } catch (error) {
    console.error(`Error removing ${key}:`, error);
  }
}

// Load transcript data, handling both chunked and non-chunked files
export async function loadTranscriptData(transcriptId: string): Promise<string | null> {
  try {
    // Check if transcript uses chunking
    const chunkInfoRaw = await safeStorageGet(`${transcriptId}-chunk-info.json`);
    
    if (chunkInfoRaw) {
      // Handle chunked data
      const chunkInfo: ChunkInfo = JSON.parse(chunkInfoRaw);
      const chunks: string[] = [];
      
      // Load all chunks
      for (let i = 0; i < chunkInfo.totalChunks; i++) {
        const chunkData = await safeStorageGet(`${transcriptId}-transcript-chunk-${i}.csv`);
        if (!chunkData) {
          console.error(`Missing chunk ${i} for transcript ${transcriptId}`);
          return null;
        }
        chunks.push(chunkData);
      }
      
      // Combine chunks, removing duplicate headers
      const combinedData = chunks.reduce((combined, chunk, index) => {
        const lines = chunk.split('\n');
        if (index === 0) {
          // First chunk - keep header
          return lines.join('\n');
        } else {
          // Subsequent chunks - skip header
          return combined + '\n' + lines.slice(1).join('\n');
        }
      }, '');
      
      return combinedData;
    } else {
      // Handle non-chunked data (legacy format)
      return await safeStorageGet(`${transcriptId}-transcript.csv`);
    }
  } catch (error) {
    console.error('Error loading transcript data:', error);
    return null;
  }
}

// Check if a transcript is chunked
export async function isTranscriptChunked(transcriptId: string): Promise<boolean> {
  const chunkInfo = await safeStorageGet(`${transcriptId}-chunk-info.json`);
  return chunkInfo !== null;
}

// Get chunk information for a transcript
export async function getChunkInfo(transcriptId: string): Promise<ChunkInfo | null> {
  try {
    const chunkInfoRaw = await safeStorageGet(`${transcriptId}-chunk-info.json`);
    return chunkInfoRaw ? JSON.parse(chunkInfoRaw) : null;
  } catch (error) {
    console.error('Error getting chunk info:', error);
    return null;
  }
}

// Save transcript data with automatic chunking if needed
export async function saveTranscriptData(transcriptId: string, csvContent: string): Promise<void> {
  const csvSizeInBytes = new Blob([csvContent]).size;
  const maxChunkSize = 4 * 1024 * 1024; // 4MB chunks
  
  if (csvSizeInBytes > maxChunkSize) {
    // Split into chunks
    const chunks = [];
    const csvLines = csvContent.split('\n');
    const headerLine = csvLines[0];
    let currentChunk = headerLine + '\n';
    let chunkIndex = 0;
    
    for (let i = 1; i < csvLines.length; i++) {
      const line = csvLines[i] + '\n';
      
      if (new Blob([currentChunk + line]).size > maxChunkSize && currentChunk !== headerLine + '\n') {
        chunks.push({
          filename: `transcript-chunk-${chunkIndex}.csv`,
          content: currentChunk.trim()
        });
        currentChunk = headerLine + '\n' + line;
        chunkIndex++;
      } else {
        currentChunk += line;
      }
    }
    
    // Add the last chunk
    if (currentChunk.trim() !== headerLine) {
      chunks.push({
        filename: `transcript-chunk-${chunkIndex}.csv`,
        content: currentChunk.trim()
      });
    }
    
    // Save chunks
    for (const chunk of chunks) {
      await safeStorageSet(`${transcriptId}-${chunk.filename}`, chunk.content);
    }
    
    // Save chunk info
    const chunkInfo: ChunkInfo = {
      totalChunks: chunks.length,
      totalSize: csvSizeInBytes,
      chunkSize: maxChunkSize
    };
    await safeStorageSet(`${transcriptId}-chunk-info.json`, JSON.stringify(chunkInfo));
    
    // Remove old non-chunked version if it exists
    await safeStorageRemove(`${transcriptId}-transcript.csv`);
  } else {
    // Save as single file
    await safeStorageSet(`${transcriptId}-transcript.csv`, csvContent);
  }
}

// Clean up chunked data when deleting a transcript
export async function cleanupTranscriptData(transcriptId: string): Promise<void> {
  const chunkInfo = await getChunkInfo(transcriptId);
  
  if (chunkInfo) {
    // Remove all chunks
    for (let i = 0; i < chunkInfo.totalChunks; i++) {
      await safeStorageRemove(`${transcriptId}-transcript-chunk-${i}.csv`);
    }
    await safeStorageRemove(`${transcriptId}-chunk-info.json`);
  } else {
    // Remove single file
    await safeStorageRemove(`${transcriptId}-transcript.csv`);
  }
  
  // Remove other associated files
  await safeStorageRemove(`${transcriptId}-speakers.json`);
  await safeStorageRemove(`${transcriptId}-content.json`);
  await safeStorageRemove(`${transcriptId}-images.json`);
  await safeStorageRemove(`${transcriptId}-original`);
}