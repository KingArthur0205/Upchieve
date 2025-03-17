import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Utility function to sanitize email for a file name
const sanitizeEmail = (email: string) => {
  return email.replace(/[^a-zA-Z0-9]/g, '_'); // Replace non-alphanumeric characters with underscores
};

export async function POST(request: Request) {
  try {
    const body = await request.json(); // Get the JSON data from the request
    const { tableData, customText, email } = body;

    // Prepare the data to save
    const dataToSave = { tableData, customText, email };

    // Sanitize email to use as a valid file name
    const sanitizedEmail = sanitizeEmail(email);

    // Define the file path to save the JSON file, based on the sanitized email
    const filePath = path.join(process.cwd(), 'data', `${sanitizedEmail}.json`); // Use the sanitized email for the file name

    // Ensure the 'data' folder exists, otherwise create it
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Write the data to a .json file
    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));

    return NextResponse.json({ message: 'Data saved as JSON successfully!' });
  } catch (error) {
    console.error('Error saving data:', error);
    return NextResponse.json({ message: 'Failed to save data.' }, { status: 500 });
  }
}
