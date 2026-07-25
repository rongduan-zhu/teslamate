import { NextResponse } from "next/server";
import { appendActivity, findActivity, readAutomation } from "@/lib/automation";
import { getDrive, updateDriveMeta } from "@/lib/drives";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const activity = await findActivity(id);
  if (!activity || activity.type !== "drive_updated" || !activity.driveId || !activity.before || !activity.after) {
    return NextResponse.json({ error: "Update activity not found" }, { status: 404 });
  }

  const automation = await readAutomation();
  if (automation.items.some((item) => item.revertsActivityId === id)) {
    return NextResponse.json({ error: "This update was already reverted" }, { status: 409 });
  }

  const current = await getDrive(activity.driveId);
  if (!current) return NextResponse.json({ error: "Drive not found" }, { status: 404 });
  if (current.notes !== activity.after.notes || !sameTags(current.tags, activity.after.tags)) {
    return NextResponse.json(
      { error: "This drive was edited after automation. Review and edit it manually to avoid losing newer changes." },
      { status: 409 }
    );
  }

  const drive = await updateDriveMeta(activity.driveId, activity.before);
  const reverted = await appendActivity({
    type: "drive_reverted",
    driveId: activity.driveId,
    driveStart: activity.driveStart,
    car: activity.car,
    before: activity.after,
    after: activity.before,
    revertsActivityId: activity.id,
  });
  return NextResponse.json({ drive, activity: reverted });
}

function sameTags(left: string[], right: string[]) {
  return [...left].sort().join("\u0000") === [...right].sort().join("\u0000");
}
