import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

export const DriveSchema = z.object({
  id: z.number().int().positive(),
  startDate: z.string(),
  endDate: z.string(),
  startAddress: z.string(),
  endAddress: z.string(),
  distanceKm: z.number(),
  notes: z.string().default(""),
  tags: z.array(z.string()).default([]),
});

export type Drive = z.infer<typeof DriveSchema>;

const drivesFile = path.join(process.cwd(), "lib", "drives.seed.json");

export async function listDrives(): Promise<Drive[]> {
  const content = await fs.readFile(drivesFile, "utf8");
  return z.array(DriveSchema).parse(JSON.parse(content));
}

export async function updateDriveMeta(
  id: number,
  params: { notes?: string; tags?: string[] }
): Promise<Drive | null> {
  const drives = await listDrives();
  const idx = drives.findIndex((d) => d.id === id);
  if (idx < 0) return null;

  const current = drives[idx];
  drives[idx] = {
    ...current,
    notes: params.notes ?? current.notes,
    tags: params.tags ?? current.tags,
  };

  await fs.writeFile(drivesFile, JSON.stringify(drives, null, 2) + "\n", "utf8");
  return drives[idx];
}

export const UpdatePayloadSchema = z.object({
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().min(1).max(64)).max(20).optional(),
});
