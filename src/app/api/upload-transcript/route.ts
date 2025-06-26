import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readdir } from 'fs/promises';
import { join } from 'path';
import * as XLSX from 'xlsx';

// Function to get the next available transcript number
async function getNextTranscriptNumber(): Promise<number> {
  const publicDir = join(process.cwd(), 'public');
  
  try {
    const items = await readdir(publicDir);
    const transcriptFolders = items.filter(item => 
      item.startsWith('t') && /^t\d+$/.test(item)
    );
    
    if (transcriptFolders.length === 0) {
      return 1;
    }
    
    const numbers = transcriptFolders.map(folder => {
      const num = parseInt(folder.substring(1));
      return isNaN(num) ? 0 : num;
    });
    
    return Math.max(...numbers) + 1;
  } catch (error) {
    console.error('Error reading public directory:', error);
    return 1;
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
    
    // Create folder path
    const publicDir = join(process.cwd(), 'public', transcriptId);
    
    // Create directory
    await mkdir(publicDir, { recursive: true });
    
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
    
    await writeFile(join(publicDir, 'transcript.csv'), fullCsvContent);
    
    // Save speaker colors
    await writeFile(join(publicDir, 'speakers.json'), JSON.stringify(speakerColors, null, 2));
    
    // Save original file
    if (file.name.endsWith('.csv')) {
      await writeFile(join(publicDir, 'transcript_original.csv'), buffer);
    } else {
      await writeFile(join(publicDir, 'transcript.xlsx'), buffer);
    }

    // Create default content.json
    const defaultContent = {
      "grade_level": "Grade Level",
      "lesson_title": "Lesson Title",
      "learning_goals": "Learning Goals",
      "materials": "Materials",
      "instructions": "Instructions"
    };
    await writeFile(join(publicDir, 'content.json'), JSON.stringify(defaultContent, null, 2));

    // Create default images.json
    const defaultImages = {
      "images": []
    };
    await writeFile(join(publicDir, 'images.json'), JSON.stringify(defaultImages, null, 2));

    return NextResponse.json({ 
      success: true, 
      transcriptId,
      speakers: Array.from(speakers),
      rowCount: validRows.length
    });

  } catch (error) {
    console.error('Error processing transcript upload:', error);
    return NextResponse.json({ 
      error: 'Failed to process transcript file' 
    }, { status: 500 });
  }
} 