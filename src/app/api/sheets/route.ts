import { google } from "googleapis";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(
          /\\n/g,
          "\n"
        ),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // First, let's get the spreadsheet metadata to see available sheets
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    });

    console.log(
      "Available sheets:",
      spreadsheet.data.sheets?.map((sheet) => sheet.properties?.title)
    );

    // Now try to get the data using the first sheet's name
    const sheetName = spreadsheet.data.sheets?.[0].properties?.title;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
    });

    return NextResponse.json(response.data.values);
  } catch (error) {
    console.error("Detailed error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch data",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
