import { NextRequest, NextResponse } from "next/server";
import { UpdatePayloadSchema, getDrive, updateDriveMeta } from "@/lib/drives";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const driveId = Number(id);
  if (!Number.isInteger(driveId) || driveId <= 0) {
    return NextResponse.json({ error: "Invalid drive id" }, { status: 400 });
  }

  const drive = await getDrive(driveId);
  return drive
    ? NextResponse.json({ drive })
    : NextResponse.json({ error: "Drive not found" }, { status: 404 });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const driveId = Number(id);
  if (!Number.isInteger(driveId) || driveId <= 0) {
    return NextResponse.json({ error: "Invalid drive id" }, { status: 400 });
  }

  const parsed = UpdatePayloadSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await updateDriveMeta(driveId, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Drive not found" }, { status: 404 });
  }

  return NextResponse.json({ drive: updated });
}
