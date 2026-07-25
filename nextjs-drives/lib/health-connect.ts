import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const MAX_PAYLOAD_BYTES = 25 * 1024 * 1024;

export const HealthConnectPayloadSchema = z
  .object({
    timestamp: z.string().min(1).max(128),
    app_version: z.string().min(1).max(64),
    test: z.boolean().optional(),
  })
  .catchall(z.unknown())
  .superRefine((payload, context) => {
    for (const [key, value] of Object.entries(payload)) {
      if (key === "timestamp" || key === "app_version" || key === "test") continue;

      if (!Array.isArray(value)) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: "Health Connect data fields must be arrays",
        });
      }
    }
  });

export type HealthConnectPayload = z.infer<typeof HealthConnectPayloadSchema>;

export type StoredHealthConnectBatch = {
  batch_id: string;
  received_at: string;
  record_count: number;
  source_record_counts?: Record<string, number>;
  payload: HealthConnectPayload;
};

export function isWebhookAuthorized(expectedToken: string, suppliedToken: string | null) {
  if (!expectedToken || !suppliedToken) return false;

  const expectedDigest = createHash("sha256").update(expectedToken).digest();
  const suppliedDigest = createHash("sha256").update(suppliedToken).digest();

  return timingSafeEqual(expectedDigest, suppliedDigest);
}

export function parseHealthConnectPayload(rawBody: string) {
  if (Buffer.byteLength(rawBody, "utf8") > MAX_PAYLOAD_BYTES) {
    throw new HealthConnectPayloadError("Payload exceeds the 25 MB limit");
  }

  let decoded: unknown;

  try {
    decoded = JSON.parse(rawBody);
  } catch {
    throw new HealthConnectPayloadError("Payload is not valid JSON");
  }

  const result = HealthConnectPayloadSchema.safeParse(decoded);

  if (!result.success) {
    throw new HealthConnectPayloadError("Payload does not match the HC Webhook format");
  }

  return result.data;
}

export function countHealthConnectRecords(payload: HealthConnectPayload) {
  return Object.entries(payload).reduce((count, [key, value]) => {
    if (
      key === "timestamp" ||
      key === "app_version" ||
      key === "test" ||
      !Array.isArray(value)
    ) {
      return count;
    }
    return count + value.length;
  }, 0);
}

export function countHealthConnectRecordsBySource(payload: HealthConnectPayload) {
  const counts: Record<string, number> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (
      key === "timestamp" ||
      key === "app_version" ||
      key === "test" ||
      !Array.isArray(value)
    ) {
      continue;
    }

    for (const record of value) {
      const source =
        isPlainObject(record) &&
        isPlainObject(record.metadata) &&
        typeof record.metadata.data_origin === "string" &&
        record.metadata.data_origin.length > 0
          ? record.metadata.data_origin
          : "unknown";

      counts[source] = (counts[source] ?? 0) + 1;
    }
  }

  return counts;
}

export async function storeHealthConnectBatch(
  payload: HealthConnectPayload,
  dataDirectory: string
) {
  const payloadJson = JSON.stringify(payload);
  const batchId = createHash("sha256").update(payloadJson).digest("hex");
  const receivedAt = new Date().toISOString();
  const batch: StoredHealthConnectBatch = {
    batch_id: batchId,
    received_at: receivedAt,
    record_count: countHealthConnectRecords(payload),
    source_record_counts: countHealthConnectRecordsBySource(payload),
    payload,
  };

  await mkdir(dataDirectory, { recursive: true });
  const destination = path.join(dataDirectory, `${batchId}.json`);

  try {
    await writeFile(destination, `${JSON.stringify(batch)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });

    return { batch, duplicate: false };
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      const existing = JSON.parse(await readFile(destination, "utf8")) as StoredHealthConnectBatch;
      existing.source_record_counts ??= countHealthConnectRecordsBySource(existing.payload);
      return { batch: existing, duplicate: true };
    }

    throw error;
  }
}

export async function getHealthConnectStatus(dataDirectory: string) {
  await mkdir(dataDirectory, { recursive: true });
  const files = (await readdir(dataDirectory)).filter((name) => name.endsWith(".json"));

  if (files.length === 0) {
    return { batches: 0, last_received_at: null, last_record_count: 0 };
  }

  const withStats = await Promise.all(
    files.map(async (name) => ({
      name,
      modifiedAt: (await stat(path.join(dataDirectory, name))).mtimeMs,
    }))
  );
  const latest = withStats.reduce((current, candidate) =>
    candidate.modifiedAt > current.modifiedAt ? candidate : current
  );
  const batch = JSON.parse(
    await readFile(path.join(dataDirectory, latest.name), "utf8")
  ) as StoredHealthConnectBatch;

  return {
    batches: files.length,
    last_received_at: batch.received_at,
    last_record_count: batch.record_count,
    last_source_record_counts:
      batch.source_record_counts ?? countHealthConnectRecordsBySource(batch.payload),
  };
}

export class HealthConnectPayloadError extends Error {}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
