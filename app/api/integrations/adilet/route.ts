import { NextResponse } from "next/server";
import { searchAdilet } from "@/lib/integrations/adilet";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  try {
    const results = await searchAdilet(query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Adilet API Error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
