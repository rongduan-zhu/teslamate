import { NextResponse } from "next/server";
import { readAutomatedDriveIds } from "@/lib/automation";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ driveIds: await readAutomatedDriveIds() });
}
