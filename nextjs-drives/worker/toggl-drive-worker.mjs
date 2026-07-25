import { appendFile, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { matchDrive } from "./matcher.mjs";
import { classifyDriveMatches } from "./codex-classifier.mjs";

const dataDir = process.env.AUTOMATION_DATA_DIR ?? "/app/data";
const activityPath = join(dataDir, "activity.jsonl");
const statusPath = join(dataDir, "status.json");
const runRequestPath = join(dataDir, "run-request");
const syncStatePath = join(dataDir, "sync-state.json");
const teslamateApi = (process.env.TESLAMATE_API_URL ?? "http://teslamate:4000/api").replace(/\/+$/, "");
const togglApi = (process.env.TOGGL_API_URL ?? "https://api.track.toggl.com/api/v9").replace(/\/+$/, "");
const togglApiToken = await loadTogglApiToken();
const intervalMs = positiveInteger(process.env.TOGGL_SYNC_INTERVAL_SECONDS, 172800) * 1000;
const minimumOverlapSeconds = positiveInteger(process.env.TOGGL_MIN_OVERLAP_SECONDS, 60);
const classifierModel = process.env.CODEX_CLASSIFIER_MODEL ?? "gpt-5.6-luna";
let running = false;

await mkdir(dataDir, { recursive: true });
const previousStatus = await readJson(statusPath, {});
await writeStatus({ ...previousStatus, state: configured() ? "idle" : "needs_configuration" });

async function runScheduledIfDue() {
  if (!configured()) return;
  const status = await readJson(statusPath, {});
  const lastRunAt = Date.parse(status.lastRunAt);
  if (Number.isFinite(lastRunAt) && Date.now() - lastRunAt < intervalMs) return;
  await runOnce("scheduled");
}

async function checkManualRequest() {
  try {
    await readFile(runRequestPath);
    await unlink(runRequestPath);
    if (configured()) await runOnce("manual");
  } catch (error) {
    if (error?.code !== "ENOENT") await record("error", { message: error.message });
  }
}

async function runOnce(trigger) {
  if (running) return;
  running = true;
  const startedAt = new Date().toISOString();
  await writeStatus({ state: "running", startedAt, trigger });
  await record("run_started", { trigger });

  let inspected = 0;
  let undocumented = 0;
  let matched = 0;
  let applied = 0;
  let windowMonth = null;

  try {
    const drives = await listAllDrives();
    inspected = drives.length;
    const candidates = drives.filter(
      (drive) => drive.endDate && !drive.notes.trim() && drive.tags.length === 0
    );
    undocumented = candidates.length;
    const selection = await selectSyncMonth(candidates);
    windowMonth = selection?.month ?? null;
    const entries = windowMonth ? await fetchTogglMonth(windowMonth) : [];
    const windowCandidates = candidates.filter((drive) => drive.startDate?.startsWith(windowMonth));
    const proposals = windowCandidates
      .map((drive) => ({ drive, match: matchDrive(drive, entries, minimumOverlapSeconds) }))
      .filter(({ match }) => match);
    matched = proposals.length;
    const decisions = await classifyDriveMatches(proposals, { model: classifierModel });
    const decisionsByDrive = new Map(decisions.map((decision) => [decision.driveId, decision]));

    for (const { drive, match: result } of proposals) {
      const decision = decisionsByDrive.get(drive.id);
      if (!decision?.associate) {
        await record("drive_rejected", {
          driveId: drive.id,
          driveStart: drive.startDate,
          classifier: { model: classifierModel, confidence: decision?.confidence, reason: decision?.reason },
          togglEntryIds: result.togglEntryIds,
          overlapSeconds: result.overlapSeconds,
        });
        continue;
      }

      const before = { notes: drive.notes, tags: drive.tags };
      const after = { notes: result.notes, tags: result.tags };
      const updated = await updateDrive(drive.id, after);
      applied += 1;
      await record("drive_updated", {
        driveId: drive.id,
        driveStart: drive.startDate,
        car: drive.car,
        before,
        after: { notes: updated.notes, tags: updated.tags },
        togglEntryIds: result.togglEntryIds,
        overlapSeconds: result.overlapSeconds,
        classifier: { model: classifierModel, confidence: decision.confidence, reason: decision.reason },
      });
    }

    if (selection) await writeJson(syncStatePath, selection.nextState);

    const completedAt = new Date().toISOString();
    const summary = { trigger, inspected, undocumented, matched, applied, windowMonth, completedAt };
    await record("run_completed", summary);
    await writeStatus({ state: "idle", ...summary, lastRunAt: completedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await record("run_failed", { trigger, message, inspected, undocumented, matched, applied, windowMonth });
    await writeStatus({ state: "error", message, windowMonth, lastRunAt: new Date().toISOString() });
  } finally {
    running = false;
  }
}

async function listAllDrives() {
  const drives = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await fetch(`${teslamateApi}/drives?page=${page}&perPage=100`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`TeslaMate returned ${response.status} while listing drives`);
    const body = await response.json();
    drives.push(...body.drives);
    totalPages = body.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);
  return drives;
}

async function fetchTogglMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  // Include a one-day boundary on either side so entries spanning midnight/month-end still match.
  const start = new Date(Date.UTC(year, monthNumber - 1, 0)).toISOString();
  const end = new Date(Date.UTC(year, monthNumber, 2)).toISOString();
  const url = new URL(`${togglApi}/me/time_entries`);
  url.searchParams.set("start_date", start);
  url.searchParams.set("end_date", end);
  url.searchParams.set("meta", "true");
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Basic ${Buffer.from(`${togglApiToken}:api_token`).toString("base64")}`,
    },
  });
  if (!response.ok) throw new Error(`Toggl returned ${response.status} for ${month}`);
  const entries = await response.json();
  if (!Array.isArray(entries)) throw new Error(`Toggl returned an invalid response for ${month}`);
  if (entries.length >= 1000) {
    throw new Error(`Toggl returned 1000 entries for ${month}; use a smaller sync window before applying changes`);
  }
  return entries.filter((entry) => entry.stop || entry.duration > 0);
}

async function selectSyncMonth(candidates) {
  const months = [...new Set(candidates.map((drive) => drive.startDate?.slice(0, 7)).filter(Boolean))].sort();
  if (months.length === 0) return null;

  const earliest = months[0];
  const newest = months.at(-1);
  const state = await readJson(syncStatePath, { mode: "recent", historyCursor: previousMonth(newest) });

  if (state.mode !== "history") {
    return {
      month: newest,
      nextState: { mode: "history", historyCursor: state.historyCursor ?? previousMonth(newest) },
    };
  }

  let historyMonth = state.historyCursor ?? previousMonth(newest);
  if (historyMonth < earliest || historyMonth >= newest) historyMonth = previousMonth(newest);
  const availableHistoryMonth = [...months].reverse().find((month) => month <= historyMonth) ?? newest;

  return {
    month: availableHistoryMonth,
    nextState: { mode: "recent", historyCursor: previousMonth(availableHistoryMonth) },
  };
}

async function updateDrive(id, metadata) {
  const response = await fetch(`${teslamateApi}/drives/${id}`, {
    method: "PATCH",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(metadata),
  });
  if (!response.ok) throw new Error(`TeslaMate returned ${response.status} while updating drive ${id}`);
  return (await response.json()).drive;
}

async function record(type, details) {
  const item = { id: randomUUID(), timestamp: new Date().toISOString(), type, ...details };
  await appendFile(activityPath, `${JSON.stringify(item)}\n`, "utf8");
}

async function writeStatus(status) {
  await writeJson(statusPath, { ...status, configured: configured(), classifierModel });
}

async function writeJson(path, value) {
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(value, null, 2), "utf8");
  await rename(temporaryPath, path);
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

function previousMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 2, 1)).toISOString().slice(0, 7);
}

function configured() {
  return Boolean(togglApiToken);
}

async function loadTogglApiToken() {
  const environmentToken = process.env.TOGGL_API_TOKEN?.trim();
  if (environmentToken) return environmentToken;

  const tokenFile = process.env.TOGGL_API_TOKEN_FILE?.trim();
  if (!tokenFile) return "";

  try {
    return (await readFile(tokenFile, "utf8")).trim();
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

await runScheduledIfDue();
setInterval(runScheduledIfDue, Math.min(intervalMs, 60_000));
setInterval(checkManualRequest, 5_000);
