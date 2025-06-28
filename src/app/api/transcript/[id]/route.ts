import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

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
  }
} catch (error) {
  console.warn('Google Cloud Storage not available for transcript data:', error);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transcriptId } = await params;
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file') || 'transcript.csv';
    
    let fileContent: string | null = null;
    let contentType = 'text/csv';
    
    // Determine content type based on file extension
    if (file.endsWith('.json')) {
      contentType = 'application/json';
    } else if (file.endsWith('.xlsx')) {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    
    if (storage && bucketName) {
      // Try to get from cloud storage
      try {
        const cloudFile = storage.bucket(bucketName).file(`transcripts/${transcriptId}/${file}`);
        const [exists] = await cloudFile.exists();
        
        if (exists) {
          if (file.endsWith('.xlsx')) {
            // For binary files, return as buffer
            const [buffer] = await cloudFile.download();
            return new NextResponse(buffer, {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${file}"`
              }
            });
          } else {
            // For text files, return as string
            const [contents] = await cloudFile.download();
            fileContent = contents.toString();
          }
        }
      } catch (error) {
        console.error(`Error reading ${file} from cloud storage:`, error);
      }
    }
    
    // Fallback to local file system
    if (!fileContent) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        
        const filePath = path.join(process.cwd(), 'public', transcriptId, file);
        
        if (fs.existsSync(filePath)) {
          if (file.endsWith('.xlsx')) {
            // For binary files, return as buffer
            const buffer = fs.readFileSync(filePath);
            return new NextResponse(buffer, {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${file}"`
              }
            });
          } else {
            // For text files, return as string
            fileContent = fs.readFileSync(filePath, 'utf8');
          }
        }
      } catch (error) {
        console.error(`Error reading ${file} from local storage:`, error);
      }
    }
    
    if (fileContent !== null) {
      return new NextResponse(fileContent, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
        }
      });
    }
    
    return NextResponse.json(
      { error: `File ${file} not found for transcript ${transcriptId}` },
      { status: 404 }
    );
    
  } catch (error) {
    console.error('Error serving transcript file:', error);
    return NextResponse.json(
      { error: 'Failed to serve transcript file' },
      { status: 500 }
    );
  }
} 