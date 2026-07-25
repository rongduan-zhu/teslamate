import { NextResponse } from "next/server";
import { readAutomation, requestRun } from "@/lib/automation";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readAutomation());
}

export async function POST() {
  const automation = await readAutomation();
  if (!automation.status.configured) {
    return NextResponse.json({ error: "Add TOGGL_API_TOKEN to enable the worker." }, { status: 409 });
  }
  await requestRun();
  return NextResponse.json({ queued: true }, { status: 202 });
}
