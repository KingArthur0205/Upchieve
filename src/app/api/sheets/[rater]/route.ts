import { google } from "googleapis";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ rater: string }> }
) {
  try {
    const { rater } = await params;

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

    // Map rater to the corresponding spreadsheet ID
    const spreadsheetMap: Record<string, string | undefined> = {
      "0": process.env.REMAINING_SPREADSHEET_ID,
      "1": process.env.RATER_1_SPREADSHEET_ID,
      "2": process.env.RATER_2_SPREADSHEET_ID,
      "3": process.env.RATER_3_SPREADSHEET_ID,
      "4": process.env.RATER_4_SPREADSHEET_ID,
      "5": process.env.RATER_5_SPREADSHEET_ID,
    };

    const spreadsheetId = spreadsheetMap[rater];

    if (!spreadsheetId) {
      return NextResponse.json(
        {
          error: "Invalid rater",
          details: "Rater must be a number between 1 and 5",
        },
        { status: 400 }
      );
    }

    // Get metadata to determine the available sheet names
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    // Use the first available sheet name
    const sheetName = spreadsheet.data.sheets?.[0].properties?.title;
    if (!sheetName) {
      return NextResponse.json(
        { error: "No sheet found", details: "Could not retrieve sheet name." },
        { status: 500 }
      );
    }

    // Fetch the data with a valid range
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`, // Ensure this range exists in your sheet
    });

    // filter rows that have been processed
    // const processedRows = new Set<string>();

    const rows = response.data.values;

    const processedRows = rows?.filter((row, index) => {
      if (index === 0) {
        return true;
      }

      if (!row) {
        return false;
      }

      // The row has already been processed if there is a matching comment_id with an appended "_"
      if (
        !!rows.find((r) => {
          return r[8]?.includes(`${row[8]}_`) || row[8]?.includes("_");
        })
      ) {
        return false;
      }

      return true;
    });

    return NextResponse.json(processedRows);
  } catch (error) {
    console.error("Detailed error:", error);
    return NextResponse.json(
      { error: "Failed to fetch data", details: (error as Error).message },
      { status: 500 }
    );
  }
}
