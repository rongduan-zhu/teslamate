import { NextResponse } from "next/server";
import { isLocalRequest, synchronizeOura } from "@/lib/oura";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isLocalRequest(request, true)) {
    return NextResponse.json({ error: "Internal sync only" }, { status: 403 });
  }
  try {
    return NextResponse.json(await synchronizeOura());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Oura sync failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
