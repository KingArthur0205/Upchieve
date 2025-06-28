import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// Function to prepare feature definition for client-side storage
async function prepareFeatureDefinition(
  file: File, 
  buffer: Buffer, 
  categories: string[], 
  featureData: { [category: string]: { Code: string; Definition: string; [key: string]: string }[] },
  isXLSX: boolean
) {
  const timestamp = new Date().toISOString();
  
  const featureDefinitions = {
    uploadedAt: timestamp,
    originalFileName: file.name,
    isXLSX: isXLSX,
    categories: categories,
    features: featureData
  };

  console.log(`Preparing feature definition for local storage with ${categories.length} categories:`, categories);
  
  return {
    cloudStorage: false,
    data: featureDefinitions,
    originalFile: {
      name: file.name,
      buffer: buffer.toString('base64')
    }
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ 
        success: false, 
        error: 'No file provided' 
      }, { status: 400 });
    }

    // Check file type
    const isXLSX = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isJSON = file.name.endsWith('.json');
    
    if (!isXLSX && !isJSON) {
      return NextResponse.json({ 
        success: false, 
        error: 'Only Excel files (.xlsx, .xls) and JSON files (.json) are supported' 
      }, { status: 400 });
    }

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ 
        success: false, 
        error: 'File size must be less than 10MB' 
      }, { status: 400 });
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    let categories: string[] = [];
    const featureData: { [category: string]: { Code: string; Definition: string; [key: string]: string }[] } = {};

    if (isJSON) {
      // Parse JSON file
      try {
        const jsonText = buffer.toString('utf-8');
        const jsonData = JSON.parse(jsonText);
        
        // Validate JSON structure
        if (!jsonData.categories || !Array.isArray(jsonData.categories)) {
          return NextResponse.json({ 
            success: false, 
            error: 'Invalid JSON format. Expected structure: { "categories": [...] }' 
          }, { status: 400 });
        }
        
        categories = jsonData.categories;
        
        // Convert categories to feature data format
        categories.forEach(category => {
          featureData[category] = []; // JSON format doesn't include feature definitions
        });
        
      } catch {
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid JSON file format' 
        }, { status: 400 });
      }
    } else {
      // Parse Excel file
      try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        // Process each sheet as a category
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
          
          if (jsonData.length === 0) {
            console.warn(`Empty sheet: ${sheetName}`);
            return;
          }
          
          // Get headers from first row
          const headers = jsonData[0] as string[];
          const codeIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('code'));
          const definitionIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('definition'));
          
          if (codeIndex === -1) {
            console.warn(`No 'Code' column found in sheet: ${sheetName}`);
            return;
          }
          
          // Extract features from remaining rows
          const features: { Code: string; Definition: string; [key: string]: string }[] = [];
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as unknown[];
            if (row && row[codeIndex] && String(row[codeIndex]).trim() !== '') {
              const feature: { Code: string; Definition: string; [key: string]: string } = {
                Code: String(row[codeIndex]).trim(),
                Definition: definitionIndex !== -1 && row[definitionIndex] 
                  ? String(row[definitionIndex]).trim() 
                  : ''
              };
              
              // Add any additional columns
              headers.forEach((header, index) => {
                if (index !== codeIndex && index !== definitionIndex && row[index]) {
                  feature[String(header)] = String(row[index]).trim();
                }
              });
              
              features.push(feature);
            }
          }
          
          if (features.length > 0) {
            categories.push(sheetName);
            featureData[sheetName] = features;
          }
        });
        
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid Excel file format' 
        }, { status: 400 });
      }
    }

    if (categories.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No valid categories found in the file' 
      }, { status: 400 });
    }

    // Prepare feature definition for client-side storage
    const prepareResult = await prepareFeatureDefinition(file, buffer, categories, featureData, isXLSX);

    return NextResponse.json({ 
      success: true, 
      message: `Feature definition uploaded successfully with ${categories.length} categories: ${categories.join(', ')}`,
      categories: categories,
      storage: prepareResult,
      annotationsCleared: true // Indicate that annotations should be cleared
    });

  } catch (error) {
    console.error('Error processing feature definition upload:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to process feature definition file' 
    }, { status: 500 });
  }
} 