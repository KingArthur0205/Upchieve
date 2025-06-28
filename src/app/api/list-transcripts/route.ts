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
    console.log('Google Cloud Storage initialized for listing transcripts');
  }
} catch (error) {
  console.warn('Google Cloud Storage not available for listing transcripts:', error);
}

export async function GET() {
  try {
    let transcriptDirs: string[] = [];
    let useCloudStorage = false;
    
    // In development, prioritize local file system
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Try local file system first (especially in development)
    if (isDevelopment || !storage || !bucketName) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        
        const transcriptsDir = path.join(process.cwd(), 'public');
        
        // Read all directories in public folder
        const items = fs.readdirSync(transcriptsDir, { withFileTypes: true });
        
        // Filter for directories that are transcripts
        transcriptDirs = items
          .filter(item => item.isDirectory())
          .map(item => item.name)
          .filter(name => {
            // Check if directory contains transcript files
            const csvPath = path.join(transcriptsDir, name, 'transcript.csv');
            const speakersPath = path.join(transcriptsDir, name, 'speakers.json');
            
            const hasFiles = fs.existsSync(csvPath) && fs.existsSync(speakersPath);
            console.log(`Checking ${name}: transcript.csv=${fs.existsSync(csvPath)}, speakers.json=${fs.existsSync(speakersPath)}`);
            return hasFiles;
          });
        
        console.log(`Found ${transcriptDirs.length} transcripts in local storage:`, transcriptDirs);
      } catch (error) {
        console.log('Error reading local transcripts:', error);
      }
    }
    
    // If no local transcripts found (or in production), try cloud storage
    if (transcriptDirs.length === 0 && storage && bucketName) {
      try {
        const [files] = await storage.bucket(bucketName).getFiles({
          prefix: 'transcripts/',
        });
        
        // Extract transcript IDs from file paths
        const transcriptIds = new Set<string>();
        files.forEach(file => {
          const match = file.name.match(/^transcripts\/([^\/]+)\//);
          if (match) {
            transcriptIds.add(match[1]);
          }
        });
        
        transcriptDirs = Array.from(transcriptIds);
        useCloudStorage = true;
        console.log(`Found ${transcriptDirs.length} transcripts in cloud storage:`, transcriptDirs);
      } catch (error) {
        console.error('Error reading from cloud storage:', error);
      }
    }

    // Categorize transcripts
    const originalTranscripts = ['t001', 't044', 't053'];
    
    const transcripts = await Promise.all(
      transcriptDirs.map(async (id) => {
        const isNew = !originalTranscripts.includes(id);
        
        // Try to get a display name from content.json
        let displayName = `Transcript ${id}`;
        
        try {
          let contentData: Record<string, unknown> | null = null;
          
          if (useCloudStorage && storage && bucketName) {
            // Try to get from cloud storage
            try {
              const file = storage.bucket(bucketName).file(`transcripts/${id}/content.json`);
              const [exists] = await file.exists();
              if (exists) {
                const [contents] = await file.download();
                contentData = JSON.parse(contents.toString());
              }
            } catch {
              console.log(`No cloud content.json for ${id}`);
            }
          } else {
            // Try local file system
            try {
              const fs = await import('fs');
              const path = await import('path');
              
              const contentPath = path.join(process.cwd(), 'public', id, 'content.json');
              if (fs.existsSync(contentPath)) {
                contentData = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
              }
            } catch {
              // No local content.json
            }
          }
          
          if (contentData) {
            // Handle both old and new content.json formats
            let title: string | null = null;
            if (contentData.lesson_title && typeof contentData.lesson_title === 'string' && contentData.lesson_title !== 'Lesson Title') {
              title = contentData.lesson_title;
            } else if (contentData.gradeLevel && typeof contentData.gradeLevel === 'string') {
              // Extract lesson name from grade level text
              const gradeLevelText = contentData.gradeLevel;
              const lessonMatch = gradeLevelText.match(/Lesson \d+: (.+)$/);
              if (lessonMatch) {
                title = lessonMatch[1];
              }
            }
            
            if (title) {
              displayName = title;
            }
          }
        } catch (error) {
          // Use default name if content.json is malformed
          console.log(`Error reading content for ${id}:`, error);
        }

        return {
          id,
          displayName,
          isNew
        };
      })
    );

    // Sort transcripts: original ones first (in order), then new ones by ID
    transcripts.sort((a, b) => {
      if (a.isNew && !b.isNew) return 1;
      if (!a.isNew && b.isNew) return -1;
      
      if (!a.isNew && !b.isNew) {
        // Sort original transcripts by their order in originalTranscripts array
        const aIndex = originalTranscripts.indexOf(a.id);
        const bIndex = originalTranscripts.indexOf(b.id);
        return aIndex - bIndex;
      }
      
      // Sort new transcripts by ID using natural sort
      const aNum = parseInt(a.id.replace('t', ''), 10);
      const bNum = parseInt(b.id.replace('t', ''), 10);
      return aNum - bNum;
    });

    console.log(`Returning ${transcripts.length} transcripts:`, transcripts.map(t => t.id));

    return NextResponse.json({
      success: true,
      transcripts
    });
  } catch (error) {
    console.error('Error listing transcripts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list transcripts' },
      { status: 500 }
    );
  }
} 