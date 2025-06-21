import { Storage } from '@google-cloud/storage';
import { NextRequest, NextResponse } from 'next/server';

// Create a Storage instance with explicit credentials
let storage: Storage;
try {
  // Decode the Base64-encoded credentials from the environment variable
  const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64 || '', 'base64').toString();
  const credentials = JSON.parse(credentialsJson);
  
  storage = new Storage({
    credentials,
    projectId: credentials.project_id
  });
  console.log('Google Cloud Storage initialized successfully for project:', credentials.project_id);
} catch (error) {
  console.error('Error initializing Google Cloud Storage:', error);
}

// Specify the name of your bucket
const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'mol_summit';

export async function POST(request: NextRequest) {
  try {
    if (!storage) {
      throw new Error('Google Cloud Storage client not properly initialized');
    }
    
    // Get the form data from the request
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const transcriptNumber = formData.get('transcriptNumber') as string;

    if (!file) {
      return NextResponse.json({ message: 'No file provided' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a unique filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const fileName = `transcript_${transcriptNumber}_annotations_${timestamp}.xlsx`;

    console.log('Uploading XLSX file:', {
      fileName,
      fileSize: buffer.length,
      transcriptNumber
    });

    // Get a reference to the bucket
    const bucket = storage.bucket(bucketName);

    // Create a file object in the bucket
    const fileObj = bucket.file(fileName);

    // Upload the file with proper metadata
    await fileObj.save(buffer, {
      metadata: {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        metadata: {
          transcriptNumber: transcriptNumber,
          uploadedAt: new Date().toISOString(),
          originalName: file.name
        }
      }
    });

    console.log('XLSX file uploaded successfully:', fileName);

    return NextResponse.json({ 
      message: 'XLSX file uploaded to Google Cloud Storage successfully!',
      fileName: fileName,
      fileSize: buffer.length
    });
  } 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catch (error: any) {
    console.error('Error uploading XLSX file:', error);
    return NextResponse.json({ 
      message: `Error uploading XLSX file: ${error?.message || 'Unknown error'}` 
    }, { status: 500 });
  }
} 