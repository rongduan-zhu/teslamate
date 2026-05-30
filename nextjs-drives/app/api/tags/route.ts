import { NextResponse } from "next/server";
import { listTags } from "@/lib/drives";

export async function GET() {
  const tags = await listTags();
  return NextResponse.json({ tags });
}
