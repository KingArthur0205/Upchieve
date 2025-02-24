import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

interface LabeledComment {
  sentences: string[];
  comment_id: string;
  excerpt: string;
  traits: string[];
  isrevisionrequested: string[];
  isrevisionclear: string[];
  ispraise: string[];
  isbad: string[];
  levelofinformation: string[];
  revisiontype: string[];
  sentencetype: string[];
  whoseideas: string[];
}

interface RequestBody {
  essayId: string;
  labeledComments: LabeledComment[];
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ rater: string }> }
) {
  try {
    const body: RequestBody = await req.json();
    const { labeledComments } = body;
    const { rater } = await params;

    // Map rater to the corresponding spreadsheet ID
    const spreadsheetMap: Record<string, string | undefined> = {
      "tester": process.env.TEST_SPREADSHEET_ID,
      "1": process.env.RATER_1_SPREADSHEET_ID,
      "2": process.env.RATER_2_SPREADSHEET_ID,
      "3": process.env.RATER_3_SPREADSHEET_ID,
      "4": process.env.RATER_4_SPREADSHEET_ID,
      "5": process.env.RATER_5_SPREADSHEET_ID,
    };

    const spreadsheetId = spreadsheetMap[rater];

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: `Invalid rater ID: ${rater}` },
        { status: 400 }
      );
    }

    // Initialize Google Sheets API
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

    // Get the spreadsheet metadata to find the sheet name
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheetName = spreadsheet.data.sheets?.[0].properties?.title;

    if (!sheetName) {
      throw new Error("Could not find sheet name");
    }

    // Get all values from the sheet to get headers and find existing rows
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values || [];
    const headers = rows[0] || [];

    // Get column indices for important fields
    const traitColumns = {
      Ideas: headers.indexOf("ideas"),
      Organization: headers.indexOf("organization"),
      Voice: headers.indexOf("voice"),
      "Word Choice": headers.indexOf("word_choice"),
      "Sentence Fluency": headers.indexOf("sentence_fluency"),
      Conventions: headers.indexOf("conventions"),
    };
    const commentCol = headers.indexOf("comment");
    const commentIdCol = headers.indexOf("comment_id");

    const isRevisionRequestedCol = headers.indexOf("isRevisionRequested");
    const isRevisionClearCol = headers.indexOf("isRevisionClear");
    const isPraiseCol = headers.indexOf("isPraise");
    const isBadCol = headers.indexOf("isBad");

    const revisionTypeCol = headers.indexOf("revisionType");
    const sentenceTypeCol = headers.indexOf("sentenceType");
    const levelOfInformationCol = headers.indexOf("levelOfInformation");
    const whoseIdeasCol = headers.indexOf("whoseIdeas");

    // Store all new sentence rows to append at the end
    const newSentenceRows: string[][] = [];
    const updatedOriginalRows: { row: string[]; index: number }[] = [];

    for (const comment of labeledComments) {
      // Find the original row for this comment
      const originalRowIndex = rows.findIndex(
        (row) => row[commentIdCol] === comment.comment_id
      );
      if (originalRowIndex === -1) continue;

      const originalRow = [...rows[originalRowIndex]];

      // Create new rows for each sentence
      comment.sentences.forEach((sentence, idx) => {
        const trait = comment.traits[idx];
        const sentenceRow = [...originalRow]; // Copy all data from original row

        // Update the sentence-specific fields
        sentenceRow[commentCol] = sentence.trim();
        sentenceRow[commentIdCol] = `${comment.comment_id}_${idx + 1}`;

        // Reset all trait columns to "0"
        Object.values(traitColumns).forEach((colIndex) => {
          if (colIndex !== -1) {
            sentenceRow[colIndex] = "0";
          }
        });

        // Set the selected trait to "1"
        const selectedTraitCol =
          traitColumns[trait as keyof typeof traitColumns];
        if (selectedTraitCol !== -1) {
          sentenceRow[selectedTraitCol] = "1";
        }

        sentenceRow[isRevisionRequestedCol] = comment.isrevisionrequested[idx]
        sentenceRow[isRevisionClearCol] = comment.isrevisionclear[idx]
        sentenceRow[isPraiseCol] = comment.ispraise[idx]
        sentenceRow[isBadCol] = comment.isbad[idx]

        sentenceRow[revisionTypeCol] = comment.revisiontype[idx]
        sentenceRow[sentenceTypeCol] = comment.sentencetype[idx]
        sentenceRow[levelOfInformationCol] = comment.levelofinformation[idx]
        sentenceRow[whoseIdeasCol] = comment.whoseideas[idx]

        newSentenceRows.push(sentenceRow);
      });
    }

    // Append all new sentence rows at once to the bottom of the sheet
    if (newSentenceRows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:${String.fromCharCode(65 + headers.length)}`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: newSentenceRows,
        },
      });
    }

    return NextResponse.json({
      success: true,
      originalRowsUpdated: updatedOriginalRows.length,
      newRowsAdded: newSentenceRows.length,
    });
  } catch (error) {
    console.error("Error updating sheet:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 }
    );
  }
}
