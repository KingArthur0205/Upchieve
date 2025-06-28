import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // For local storage deployment, transcripts are stored in browser localStorage
    // Return empty list since we can't access browser storage from server-side
    // The client-side will manage transcript listing from localStorage
    
    console.log('List transcripts API called - returning empty list for local storage mode');
    
    return NextResponse.json({
      success: true,
      transcripts: [],
      source: 'local-storage-mode',
      message: 'Transcripts are stored locally in browser storage'
    });

  } catch (error) {
    console.error('Error in list transcripts API:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to list transcripts',
      transcripts: []
    });
  }
} 