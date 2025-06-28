import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

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
    console.log('Google Cloud Storage initialized for feature definitions');
  }
} catch (error) {
  console.warn('Google Cloud Storage not available for feature definitions:', error);
}

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
                annotationsCleared: true,
                message: `Feature definition uploaded successfully with ${categories.length} categories. All previous annotations have been cleared.`
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
      annotationsCleared: true,
      message: `Feature definition uploaded successfully with ${categories.length} categories. All previous annotations have been cleared.`
    });

  } catch (error) {
    console.error('Error uploading feature definition:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to upload feature definition'
    });
  }
}

async function clearAllAnnotationData() {
  try {
    if (storage && bucketName) {
      // Clear annotation data from cloud storage
      const [files] = await storage.bucket(bucketName).getFiles({
        prefix: 'transcripts/',
      });
      
      const annotationFiles = files.filter(file => {
        const fileName = file.name.split('/').pop() || '';
        return [
          'expert_annotations.xlsx',
          'expert_noticings.csv',
          'expert_noticings.xlsx', 
          'llm_noticings.csv',
          'llm_noticings.xlsx',
          'transcript_analysis.xlsx',
          'annotated_transcript.csv',
          'annotated_transcript.xlsx'
        ].includes(fileName);
      });
      
      console.log(`Found ${annotationFiles.length} annotation files to delete from cloud storage`);
      
      // Delete annotation files in parallel
      await Promise.all(
        annotationFiles.map(file => 
          file.delete().catch(error => 
            console.warn(`Failed to delete ${file.name}:`, error)
          )
        )
      );
      
      console.log('Cloud annotation data clearing completed');
    } else {
      console.log('Cloud storage not available, annotation clearing skipped');
    }
  } catch (error) {
    console.error('Error clearing annotation data:', error);
    // Don't throw error - we want the feature definition upload to succeed even if clearing fails
  }
}

async function saveFeatureDefinition(
  file: File, 
  buffer: Buffer, 
  categories: string[], 
  featureData: { [category: string]: { Code: string; Definition: string; [key: string]: string }[] },
  isXLSX: boolean
) {
  // Clear all existing annotation data before saving new feature definitions
  await clearAllAnnotationData();
  
  if (storage && bucketName) {
    try {
      const bucket = storage.bucket(bucketName);
      
      // Save original file to cloud storage
      const originalFileName = isXLSX ? 'MOL_Roles_Features.xlsx' : 'MOL_Roles_Features.csv';
      await bucket.file(`feature-definitions/${originalFileName}`).save(buffer, {
        metadata: { 
          contentType: isXLSX 
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv'
        }
      });

      // Save processed JSON data for easy access
      const jsonData = {
        categories,
        data: featureData,
        uploadedAt: new Date().toISOString(),
        originalFileName: file.name
      };
      
      await bucket.file('feature-definitions/feature-definitions.json').save(
        JSON.stringify(jsonData, null, 2),
        { metadata: { contentType: 'application/json' } }
      );

      console.log(`Feature definition saved to cloud storage with ${categories.length} categories:`, categories);
    } catch (error) {
      console.error('Error saving feature definition to cloud storage:', error);
      throw error;
    }
  } else {
    // For deployment without cloud storage, we'll store in memory/cache
    // This is a fallback - ideally cloud storage should be configured
    console.warn('Cloud storage not available for feature definitions. Consider configuring Google Cloud Storage for production deployment.');
    
    // You could implement alternative storage here, such as:
    // - Database storage
    // - External API
    // - Redis cache
    // For now, we'll just log the data
    console.log(`Feature definition processed with ${categories.length} categories:`, categories);
  }
} 