import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine file type
    const isXLSX = file.name.toLowerCase().endsWith('.xlsx');
    const isCSV = file.name.toLowerCase().endsWith('.csv');

    if (!isXLSX && !isCSV) {
      return NextResponse.json({ 
        success: false, 
        error: 'Only XLSX and CSV files are supported' 
      });
    }

    let categories: string[] = [];
    const featureData: { [category: string]: { Code: string; Definition: string; [key: string]: string }[] } = {};

    if (isXLSX) {
      // Parse XLSX file
      const workbook = XLSX.read(buffer);
      categories = workbook.SheetNames;

      // Process each sheet
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, string>[];

        // Validate that the sheet has required columns
        if (jsonData.length > 0) {
          const firstRow = jsonData[0];
          const hasCode = 'Code' in firstRow || 'code' in firstRow;
          const hasDefinition = 'Definition' in firstRow || 'definition' in firstRow;

          if (!hasCode || !hasDefinition) {
            return NextResponse.json({
              success: false,
              error: `Sheet "${sheetName}" must have at least "Code" and "Definition" columns`
            });
          }

          // Normalize column names
          const normalizedData = jsonData.map(row => ({
            Code: row.Code || row.code,
            Definition: row.Definition || row.definition,
            Example1: row.Example1 || row.example1 || '',
            Example2: row.Example2 || row.example2 || '',
            NonExample1: row.NonExample1 || row.nonexample1 || '',
            NonExample2: row.NonExample2 || row.nonexample2 || '',
            ...row
          }));

          featureData[sheetName] = normalizedData;
        }
      }
    } else if (isCSV) {
      // Parse CSV file
      const csvText = buffer.toString('utf8');
      
      return new Promise<NextResponse>((resolve) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: async (result) => {
            try {
              if (result.errors.length > 0) {
                resolve(NextResponse.json({
                  success: false,
                  error: 'CSV parsing error: ' + result.errors.map(e => e.message).join(', ')
                }));
                return;
              }

              const data = result.data as Record<string, string>[];
              
              // Validate required columns
              if (data.length > 0) {
                const firstRow = data[0];
                const hasCode = 'Code' in firstRow || 'code' in firstRow;
                const hasDefinition = 'Definition' in firstRow || 'definition' in firstRow;

                if (!hasCode || !hasDefinition) {
                  resolve(NextResponse.json({
                    success: false,
                    error: 'CSV file must have at least "Code" and "Definition" columns'
                  }));
                  return;
                }

                // Use filename (without extension) as category name
                const categoryName = file.name.replace(/\.(csv|CSV)$/, '');
                categories = [categoryName];

                // Normalize column names
                const normalizedData = data.map(row => ({
                  Code: row.Code || row.code,
                  Definition: row.Definition || row.definition,
                  Example1: row.Example1 || row.example1 || '',
                  Example2: row.Example2 || row.example2 || '',
                  NonExample1: row.NonExample1 || row.nonexample1 || '',
                  NonExample2: row.NonExample2 || row.nonexample2 || '',
                  ...row
                }));

                featureData[categoryName] = normalizedData;
              }

              // Save the processed data and original file
              await saveFeatureDefinition(file, buffer, categories, featureData, isXLSX);

              resolve(NextResponse.json({
                success: true,
                categories,
                message: `Feature definition uploaded successfully with ${categories.length} categories`
              }));
            } catch (error) {
              console.error('Error processing CSV:', error);
              resolve(NextResponse.json({
                success: false,
                error: 'Failed to process CSV file'
              }));
            }
          }
        });
      });
    }

    // Save the processed data for XLSX files
    await saveFeatureDefinition(file, buffer, categories, featureData, isXLSX);

    return NextResponse.json({
      success: true,
      categories,
      message: `Feature definition uploaded successfully with ${categories.length} categories`
    });

  } catch (error) {
    console.error('Error uploading feature definition:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to upload feature definition'
    });
  }
}

async function saveFeatureDefinition(
  file: File, 
  buffer: Buffer, 
  categories: string[], 
  featureData: { [category: string]: { Code: string; Definition: string; [key: string]: string }[] },
  isXLSX: boolean
) {
  const publicDir = path.join(process.cwd(), 'public');
  
  // Save original file
  const originalFileName = isXLSX ? 'MOL Roles Features.xlsx' : 'MOL Roles Features.csv';
  const originalPath = path.join(publicDir, originalFileName);
  await writeFile(originalPath, buffer);

  // Save processed JSON data for easy access
  const jsonPath = path.join(publicDir, 'feature-definitions.json');
  const jsonData = {
    categories,
    data: featureData,
    uploadedAt: new Date().toISOString(),
    originalFileName: file.name
  };
  await writeFile(jsonPath, JSON.stringify(jsonData, null, 2));

  console.log(`Feature definition saved with ${categories.length} categories:`, categories);
} 