import { Storage } from '@google-cloud/storage';
import { NextResponse } from 'next/server';

// Create a Storage instance with explicit credentials
let storage: Storage;
try {
  // Parse the credentials from the environment variable
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}');
  
  storage = new Storage({
    credentials,
    projectId: credentials.project_id
  });
} catch (error) {
  console.error('Error initializing Google Cloud Storage:', error);
}

// Specify the name of your bucket
const bucketName = 'mol_temp1'; // Replace with your GCS bucket name

export async function POST(request: Request) {
  try {
    const body = await request.json(); // Get the JSON data from the request
    const { tableData, customText, email } = body;

    // Prepare the data to save
    const dataToSave = { tableData, customText, email };

    // Sanitize email to use as a valid file name
    const sanitizedEmail = sanitizeEmail(email);

    // Define the file path and name in GCS
    const fileName = `${sanitizedEmail}.json`;

    // Get a reference to the bucket
    const bucket = storage.bucket(bucketName);

    // Create a file object in the bucket
    const file = bucket.file(fileName);

    // Write the data to the GCS file
    await file.save(JSON.stringify(dataToSave, null, 2));

    return NextResponse.json({ message: 'Data saved to Google Cloud Storage successfully!' });
  } catch (error) {
    console.error('Error saving data:', error);
    return NextResponse.json({ message: 'Failed to save data to GCS.' }, { status: 500 });
  }
}

// Helper function to sanitize email to be a valid file name
function sanitizeEmail(email: string): string {
  return email.replace(/[^a-zA-Z0-9]/g, '_'); // Replace invalid characters with '_'
}
