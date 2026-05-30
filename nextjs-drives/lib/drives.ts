import { z } from "zod";

export const DriveSchema = z.object({
  id: z.number().int().positive(),
  car: z.string().default(""),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  startAddress: z.string(),
  endAddress: z.string(),
  startLocation: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .nullable()
    .default(null),
  endLocation: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .nullable()
    .default(null),
  distanceKm: z.number(),
  notes: z.string().default(""),
  tags: z.array(z.string()).default([]),
});

export type Drive = z.infer<typeof DriveSchema>;

const DrivesResponseSchema = z.object({
  drives: z.array(DriveSchema),
});

const DriveResponseSchema = z.object({
  drive: DriveSchema,
});

const TagsResponseSchema = z.object({
  tags: z.array(z.string()),
});

const apiBaseUrl = (process.env.TESLAMATE_API_URL ?? "http://localhost:4000/api").replace(
  /\/+$/,
  ""
);

export async function listDrives(): Promise<Drive[]> {
  const response = await fetch(`${apiBaseUrl}/drives`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`TeslaMate API returned ${response.status} while listing drives`);
  }

  return DrivesResponseSchema.parse(await response.json()).drives;
}

export async function updateDriveMeta(
  id: number,
  params: { notes?: string; tags?: string[] }
): Promise<Drive | null> {
  const response = await fetch(`${apiBaseUrl}/drives/${id}`, {
    method: "PATCH",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(params),
    cache: "no-store",
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`TeslaMate API returned ${response.status} while updating drive ${id}`);
  }

  return DriveResponseSchema.parse(await response.json()).drive;
}

export async function listTags(): Promise<string[]> {
  const response = await fetch(`${apiBaseUrl}/tags`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`TeslaMate API returned ${response.status} while listing tags`);
  }

  return TagsResponseSchema.parse(await response.json()).tags;
}

export const UpdatePayloadSchema = z.object({
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().min(1).max(64)).max(20).optional(),
});
