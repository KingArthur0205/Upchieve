import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const transcriptsDir = path.join(process.cwd(), 'public');
    
    // Read all directories in public folder
    const items = fs.readdirSync(transcriptsDir, { withFileTypes: true });
    
    // Filter for directories that are transcripts
    const transcriptDirs = items
      .filter(item => item.isDirectory())
      .map(item => item.name)
      .filter(name => {
        // Check if directory contains transcript files (either transcript.csv or table.json)
        const csvPath = path.join(transcriptsDir, name, 'transcript.csv');
        const tablePath = path.join(transcriptsDir, name, 'table.json');
        const speakersPath = path.join(transcriptsDir, name, 'speakers.json');
        
        // A valid transcript directory should have either:
        // 1. transcript.csv + speakers.json (old format)
        // 2. table.json (new format, though currently not used)
        return (fs.existsSync(csvPath) && fs.existsSync(speakersPath)) || fs.existsSync(tablePath);
      });

    // Categorize transcripts
    const originalTranscripts = ['t001', 't044', 't053'];
    
    const transcripts = transcriptDirs.map(id => {
      const isNew = !originalTranscripts.includes(id);
      
      // Try to get a display name from content.json if it exists
      let displayName = `Transcript ${id}`;
      try {
        const contentPath = path.join(transcriptsDir, id, 'content.json');
        if (fs.existsSync(contentPath)) {
          const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
          
          // Handle both old and new content.json formats
          let title = null;
          if (content.lesson_title && content.lesson_title !== 'Lesson Title') {
            title = content.lesson_title;
          } else if (content.gradeLevel) {
            // Extract just the lesson part from the old format
            const gradeLevelText = content.gradeLevel;
            // Try to extract lesson name from strings like "Grade: 7, Unit 3: Measuring Circles, Lesson 6: Exploring Circle Area"
            const lessonMatch = gradeLevelText.match(/Lesson \d+: (.+)$/);
            if (lessonMatch) {
              title = lessonMatch[1];
            }
          }
          
          if (title) {
            displayName = title;
          }
        }
      } catch {
        // Use default name if content.json is malformed
      }

      return {
        id,
        displayName,
        isNew
      };
    });

    // Sort transcripts: original ones first (in order), then new ones by ID (natural sort)
    transcripts.sort((a, b) => {
      if (a.isNew && !b.isNew) return 1;
      if (!a.isNew && b.isNew) return -1;
      
      if (!a.isNew && !b.isNew) {
        // Sort original transcripts by their order in originalTranscripts array
        const aIndex = originalTranscripts.indexOf(a.id);
        const bIndex = originalTranscripts.indexOf(b.id);
        return aIndex - bIndex;
      }
      
      // Sort new transcripts by ID using natural sort (t001, t002, t010, t011...)
      const aNum = parseInt(a.id.replace('t', ''), 10);
      const bNum = parseInt(b.id.replace('t', ''), 10);
      return aNum - bNum;
    });

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