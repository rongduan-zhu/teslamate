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

export const PaginationSchema = z.object({
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().positive(),
});

const DrivesResponseSchema = z.object({
  drives: z.array(DriveSchema),
  cars: z.array(z.string()).default([]),
  pagination: PaginationSchema,
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

export type DrivesPage = z.infer<typeof DrivesResponseSchema>;

export type ListDrivesParams = {
  page?: number;
  perPage?: number;
  car?: string;
};

export async function listDrives(params: ListDrivesParams = {}): Promise<DrivesPage> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set("page", String(params.page));
  if (params.perPage) searchParams.set("perPage", String(params.perPage));
  if (params.car) searchParams.set("car", params.car);

  const queryString = searchParams.toString();
  const response = await fetch(`${apiBaseUrl}/drives${queryString ? `?${queryString}` : ""}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`TeslaMate API returned ${response.status} while listing drives`);
  }

  return DrivesResponseSchema.parse(await response.json());
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

export async function getDrive(id: number): Promise<Drive | null> {
  const response = await fetch(`${apiBaseUrl}/drives/${id}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`TeslaMate API returned ${response.status} while loading drive ${id}`);
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
