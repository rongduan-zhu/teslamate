import { NextResponse } from "next/server";
import { listDrives } from "@/lib/drives";

export async function GET() {
  const drives = await listDrives();
  return NextResponse.json({ drives });
}
