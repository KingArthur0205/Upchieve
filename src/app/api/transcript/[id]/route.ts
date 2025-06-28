import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const file = url.searchParams.get('file');

    if (!file) {
      return NextResponse.json(
        { error: 'File parameter is required' },
        { status: 400 }
      );
    }

    // For local storage mode, return a message indicating client should use localStorage
    return NextResponse.json({
      error: 'Local storage mode - files should be loaded from browser localStorage',
      useLocalStorage: true,
      transcriptId: id,
      filename: file,
      localStorageKey: `${id}-${file}`
    }, { status: 404 });

  } catch (error) {
    console.error('Error in transcript API:', error);
    return NextResponse.json(
      { error: 'Failed to load transcript file' },
      { status: 500 }
    );
  }
} 