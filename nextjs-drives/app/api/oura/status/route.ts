import { NextResponse } from "next/server";
import { getPublicStatus, isLocalRequest } from "@/lib/oura";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Local status only" }, { status: 403 });
  }
  return NextResponse.json(await getPublicStatus());
}
