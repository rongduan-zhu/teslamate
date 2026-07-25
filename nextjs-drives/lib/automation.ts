import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

const dataDir = process.env.AUTOMATION_DATA_DIR ?? "/app/data";
const activityPath = join(dataDir, "activity.jsonl");
const statusPath = join(dataDir, "status.json");
export const runRequestPath = join(dataDir, "run-request");

export type DriveMetadata = { notes: string; tags: string[] };
export type ActivityItem = {
  id: string;
  timestamp: string;
  type: string;
  driveId?: number;
  driveStart?: string;
  car?: string;
  before?: DriveMetadata;
  after?: DriveMetadata;
  togglEntryIds?: number[];
  overlapSeconds?: number;
  revertsActivityId?: string;
  message?: string;
  trigger?: string;
  inspected?: number;
  undocumented?: number;
  matched?: number;
  applied?: number;
  windowMonth?: string;
};

export async function readAutomation() {
  await mkdir(dataDir, { recursive: true });
  const [items, status] = await Promise.all([
    readItems(),
    readJson(statusPath, { configured: false, state: "starting" }),
  ]);
  return { items: items.slice(-200).reverse(), status };
}

export async function findActivity(id: string) {
  const items = await readItems();
  return items.find((item) => item.id === id) ?? null;
}

export async function readAutomatedDriveIds() {
  const automated = new Set<number>();
  for (const item of await readItems()) {
    if (!item.driveId) continue;
    if (item.type === "drive_updated") automated.add(item.driveId);
    if (item.type === "drive_reverted") automated.delete(item.driveId);
  }
  return [...automated];
}

export async function appendActivity(item: Omit<ActivityItem, "id" | "timestamp">) {
  await mkdir(dataDir, { recursive: true });
  const record: ActivityItem = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...item,
  };
  await appendFile(activityPath, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function requestRun() {
  await mkdir(dataDir, { recursive: true });
  await writeFile(runRequestPath, new Date().toISOString(), "utf8");
}

async function readItems(): Promise<ActivityItem[]> {
  try {
    const text = await readFile(activityPath, "utf8");
    return text.split("\n").filter(Boolean).flatMap((line) => {
      try {
        return [JSON.parse(line) as ActivityItem];
      } catch {
        return [];
      }
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function readJson(path: string, fallback: object) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}
