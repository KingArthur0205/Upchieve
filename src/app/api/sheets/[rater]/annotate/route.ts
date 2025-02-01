import { google } from "googleapis";
import { NextResponse } from "next/server";

export async function PUT(
  req: Request,
  { params }: { params: { rater: string } }
) {
  try {
    console.log("req", await req.json());
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating sheet:", error);

    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
