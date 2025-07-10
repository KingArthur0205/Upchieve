// Utility functions for handling chunked transcript data storage

interface ChunkInfo {
  totalChunks: number;
  totalSize: number;
  chunkSize: number;
}

// Load transcript data, handling both chunked and non-chunked files
export function loadTranscriptData(transcriptId: string): string | null {
  try {
    // Check if transcript uses chunking
    const chunkInfoRaw = localStorage.getItem(`${transcriptId}-chunk-info.json`);
    
    if (chunkInfoRaw) {
      // Handle chunked data
      const chunkInfo: ChunkInfo = JSON.parse(chunkInfoRaw);
      const chunks: string[] = [];
      
      // Load all chunks
      for (let i = 0; i < chunkInfo.totalChunks; i++) {
        const chunkData = localStorage.getItem(`${transcriptId}-transcript-chunk-${i}.csv`);
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
      return localStorage.getItem(`${transcriptId}-transcript.csv`);
    }
  } catch (error) {
    console.error('Error loading transcript data:', error);
    return null;
  }
}

// Check if a transcript is chunked
export function isTranscriptChunked(transcriptId: string): boolean {
  return localStorage.getItem(`${transcriptId}-chunk-info.json`) !== null;
}

// Get chunk information for a transcript
export function getChunkInfo(transcriptId: string): ChunkInfo | null {
  try {
    const chunkInfoRaw = localStorage.getItem(`${transcriptId}-chunk-info.json`);
    return chunkInfoRaw ? JSON.parse(chunkInfoRaw) : null;
  } catch (error) {
    console.error('Error getting chunk info:', error);
    return null;
  }
}

// Save transcript data with automatic chunking if needed
export function saveTranscriptData(transcriptId: string, csvContent: string): void {
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
    chunks.forEach(chunk => {
      localStorage.setItem(`${transcriptId}-${chunk.filename}`, chunk.content);
    });
    
    // Save chunk info
    const chunkInfo: ChunkInfo = {
      totalChunks: chunks.length,
      totalSize: csvSizeInBytes,
      chunkSize: maxChunkSize
    };
    localStorage.setItem(`${transcriptId}-chunk-info.json`, JSON.stringify(chunkInfo));
    
    // Remove old non-chunked version if it exists
    localStorage.removeItem(`${transcriptId}-transcript.csv`);
  } else {
    // Save as single file
    localStorage.setItem(`${transcriptId}-transcript.csv`, csvContent);
  }
}

// Clean up chunked data when deleting a transcript
export function cleanupTranscriptData(transcriptId: string): void {
  const chunkInfo = getChunkInfo(transcriptId);
  
  if (chunkInfo) {
    // Remove all chunks
    for (let i = 0; i < chunkInfo.totalChunks; i++) {
      localStorage.removeItem(`${transcriptId}-transcript-chunk-${i}.csv`);
    }
    localStorage.removeItem(`${transcriptId}-chunk-info.json`);
  } else {
    // Remove single file
    localStorage.removeItem(`${transcriptId}-transcript.csv`);
  }
  
  // Remove other associated files
  localStorage.removeItem(`${transcriptId}-speakers.json`);
  localStorage.removeItem(`${transcriptId}-content.json`);
  localStorage.removeItem(`${transcriptId}-images.json`);
  localStorage.removeItem(`${transcriptId}-original`);
}