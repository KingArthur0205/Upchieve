import { NextResponse } from 'next/server';
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
    console.log('Google Cloud Storage initialized for feature categories');
  }
} catch (error) {
  console.warn('Google Cloud Storage not available for feature categories:', error);
}

export async function GET() {
  try {
    if (storage && bucketName) {
      // Try to get feature definitions from cloud storage
      try {
        const bucket = storage.bucket(bucketName);
        const file = bucket.file('feature-definitions/feature-definitions.json');
        
        const [exists] = await file.exists();
        if (exists) {
          const [contents] = await file.download();
          const featureData = JSON.parse(contents.toString());
          
          return NextResponse.json({
            success: true,
            categories: featureData.categories || [],
            source: 'cloud-storage',
            uploadedAt: featureData.uploadedAt
          });
        }
      } catch (error) {
        console.error('Error reading from cloud storage:', error);
      }
    }
    
    // Fallback: try to read from local file system (for development)
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const publicDir = path.join(process.cwd(), 'public');
      const jsonPath = path.join(publicDir, 'feature-definitions.json');
      
      const data = await fs.readFile(jsonPath, 'utf8');
      const featureData = JSON.parse(data);
      
      return NextResponse.json({
        success: true,
        categories: featureData.categories || [],
        source: 'local-file',
        uploadedAt: featureData.uploadedAt
      });
         } catch {
       console.log('No local feature definitions found');
     }

    // If no files exist, return empty categories
    return NextResponse.json({
      success: true,
      categories: [],
      source: 'fallback'
    });

  } catch (error) {
    console.error('Error getting feature categories:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get feature categories',
      categories: [] // Fallback
    });
  }
} 