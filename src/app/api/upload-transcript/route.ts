import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import * as XLSX from 'xlsx';

// Initialize Google Cloud Storage (if available)
let storage: Storage | null = null;
let bucketName = '';

try {
  if (process.env.GOOGLE_CREDENTIALS_BASE64 && process.env.GOOGLE_CLOUD_BUCKET_NAME) {
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString();
    const credentials = JSON.parse(credentialsJson);
    
    storage = new Storage({
      credentials,
      projectId: credentials.project_id
    });
    
    bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME;
    console.log('Google Cloud Storage initialized for transcript uploads');
  }
} catch (error) {
  console.warn('Google Cloud Storage not available for transcript uploads:', error);
}

// Function to get the next available transcript number
async function getNextTranscriptNumber(): Promise<number> {
  try {
    if (storage && bucketName) {
      // Use cloud storage to find existing transcripts
      const [files] = await storage.bucket(bucketName).getFiles({
        prefix: 'transcripts/t',
        delimiter: '/'
      });
      
      const transcriptNumbers = files
        .map(file => {
          const match = file.name.match(/transcripts\/t(\d+)\//);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(num => num > 0);
      
      return transcriptNumbers.length > 0 ? Math.max(...transcriptNumbers) + 1 : 1;
    }
    
    // Fallback: return timestamp-based number for deployment without cloud storage
    return Date.now() % 100000; // Use last 5 digits of timestamp
  } catch (error) {
    console.error('Error getting next transcript number:', error);
    return Date.now() % 100000;
  }
}

// Function to save files to cloud storage or return data for client-side storage
async function saveTranscriptFiles(
  transcriptId: string,
  csvContent: string,
  originalBuffer: Buffer,
  originalFileName: string,
  speakerColors: { [key: string]: string }
) {
  if (storage && bucketName) {
    try {
      const bucket = storage.bucket(bucketName);
      const basePath = `transcripts/${transcriptId}/`;
      
      // Save CSV transcript
      await bucket.file(`${basePath}transcript.csv`).save(csvContent, {
        metadata: { contentType: 'text/csv' }
      });
      
      // Save original file
      const originalExt = originalFileName.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx';
      await bucket.file(`${basePath}transcript_original.${originalExt}`).save(originalBuffer, {
        metadata: { 
          contentType: originalExt === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      });
      
      // Save speaker colors
      await bucket.file(`${basePath}speakers.json`).save(JSON.stringify(speakerColors, null, 2), {
        metadata: { contentType: 'application/json' }
      });
      
      // Save default content
      const defaultContent = {
        "gradeLevel": "Grade Level",
        "lessonGoal": "Lesson Goal"
      };
      await bucket.file(`${basePath}content.json`).save(JSON.stringify(defaultContent, null, 2), {
        metadata: { contentType: 'application/json' }
      });
      
      // Save default images
      const defaultImages = { "images": [] };
      await bucket.file(`${basePath}images.json`).save(JSON.stringify(defaultImages, null, 2), {
        metadata: { contentType: 'application/json' }
      });
      
      console.log(`Transcript ${transcriptId} saved to cloud storage successfully`);
      return { cloudStorage: true };
    } catch (error) {
      console.error('Error saving to cloud storage:', error);
      throw error;
    }
  } else {
    // Return data for client-side storage or alternative handling
    console.log('Cloud storage not available, returning data for alternative storage');
    return {
      cloudStorage: false,
      files: {
        'transcript.csv': csvContent,
        'speakers.json': JSON.stringify(speakerColors, null, 2),
        'content.json': JSON.stringify({
          "gradeLevel": "Grade Level", 
          "lessonGoal": "Lesson Goal"
        }, null, 2),
        'images.json': JSON.stringify({ "images": [] }, null, 2)
      },
      originalFile: {
        name: originalFileName,
        buffer: originalBuffer.toString('base64')
      }
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Only Excel files (.xlsx, .xls) and CSV files (.csv) are supported' }, { status: 400 });
    }

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    let jsonData: unknown[][];
    
    if (file.name.endsWith('.csv')) {
      // Parse CSV file
      const csvText = buffer.toString('utf-8');
      const rows = csvText.split('\n').filter(row => row.trim() !== '');
      
      jsonData = rows.map(row => {
        // Simple CSV parsing - handle quoted fields
        const cells = [];
        let currentCell = '';
        let inQuotes = false;
        
        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          
          if (char === '"') {
            if (inQuotes && row[i + 1] === '"') {
              // Escaped quote
              currentCell += '"';
              i++; // Skip next quote
            } else {
              // Toggle quote state
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            // End of cell
            cells.push(currentCell.trim());
            currentCell = '';
          } else {
            currentCell += char;
          }
        }
        
        // Add the last cell
        cells.push(currentCell.trim());
        return cells;
      });
    } else {
      // Read the Excel file
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    }
    
    if (jsonData.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    if (jsonData.length < 2) {
      return NextResponse.json({ error: 'File must contain at least one data row' }, { status: 400 });
    }

    // Get headers (first row)
    const headers = jsonData[0] as string[];
    
    // Check for required columns
    const requiredColumns = ['#', 'Speaker', 'Dialogue'];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      return NextResponse.json({ 
        error: `Missing required columns: ${missingColumns.join(', ')}` 
      }, { status: 400 });
    }

    // Find column indices
    const hashIndex = headers.indexOf('#');
    const speakerIndex = headers.indexOf('Speaker');
    const dialogueIndex = headers.indexOf('Dialogue');

    // Extract data rows (skip header)
    const dataRows = jsonData.slice(1) as unknown[][];
    
    // Validate data rows
    const validRows = dataRows.filter(row => {
      return row && 
             row.length > Math.max(hashIndex, speakerIndex, dialogueIndex) &&
             row[speakerIndex] && 
             row[dialogueIndex] &&
             String(row[speakerIndex]).trim() !== '' &&
             String(row[dialogueIndex]).trim() !== '';
    });

    if (validRows.length === 0) {
      return NextResponse.json({ error: 'No valid data rows found' }, { status: 400 });
    }
    
    // Get unique speakers
    const speakers = new Set<string>();
    validRows.forEach(row => {
      if (row[speakerIndex] && typeof row[speakerIndex] === 'string') {
        speakers.add(row[speakerIndex].trim());
      }
    });

    if (speakers.size === 0) {
      return NextResponse.json({ error: 'No valid speakers found' }, { status: 400 });
    }

    // Generate speaker colors
    const speakerColors: { [key: string]: string } = {};
    const colorClasses = [
      'bg-red-200', 'bg-blue-200', 'bg-green-200', 'bg-yellow-200', 
      'bg-purple-200', 'bg-pink-200', 'bg-indigo-200', 'bg-gray-200',
      'bg-orange-200', 'bg-teal-200', 'bg-cyan-200', 'bg-lime-200'
    ];
    
    Array.from(speakers).forEach((speaker, index) => {
      speakerColors[speaker] = colorClasses[index % colorClasses.length];
    });

    // Get next available transcript number
    const nextNumber = await getNextTranscriptNumber();
    const transcriptId = `t${nextNumber.toString().padStart(3, '0')}`;
    
    // Save transcript as CSV (use valid rows only)
    const csvContent = validRows.map(row => {
      return row.map(cell => {
        if (cell === null || cell === undefined) return '';
        const cellStr = String(cell);
        // Escape quotes and wrap in quotes if contains comma or quote
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',');
    }).join('\n');
    
    const csvHeader = headers.join(',');
    const fullCsvContent = csvHeader + '\n' + csvContent;
    
    // Save files (either to cloud storage or return for alternative handling)
    const saveResult = await saveTranscriptFiles(
      transcriptId,
      fullCsvContent,
      buffer,
      file.name,
      speakerColors
    );

    return NextResponse.json({ 
      success: true, 
      transcriptId,
      speakers: Array.from(speakers),
      rowCount: validRows.length,
      storage: saveResult
    });

  } catch (error) {
    console.error('Error processing transcript upload:', error);
    return NextResponse.json({ 
      error: 'Failed to process transcript file' 
    }, { status: 500 });
  }
} 