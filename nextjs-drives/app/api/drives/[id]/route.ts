import { NextRequest, NextResponse } from "next/server";
import { UpdatePayloadSchema, updateDriveMeta } from "@/lib/drives";

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
