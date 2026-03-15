import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  return NextResponse.json({ k: key });
}
