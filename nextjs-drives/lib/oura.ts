import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = process.env.OURA_DATA_DIR ?? "/app/data/oura";
const PRIVATE_DIR = path.join(DATA_DIR, "private");
const RECORDS_DIR = path.join(DATA_DIR, "records");
const KEY_PATH = path.join(PRIVATE_DIR, "storage.key");
const CREDENTIALS_PATH = path.join(PRIVATE_DIR, "credentials.enc");
const TOKENS_PATH = path.join(PRIVATE_DIR, "tokens.enc");
const STATE_PATH = path.join(PRIVATE_DIR, "oauth-state.enc");
const STATUS_PATH = path.join(DATA_DIR, "status.json");

export const OURA_REDIRECT_URI =
  process.env.OURA_REDIRECT_URI ??
  "https://pruinose-concavely-natisha.ngrok-free.app/api/oura/callback";
export const OURA_SCOPES = "daily heartrate workout spo2";

type Credentials = { clientId: string; clientSecret: string };
type Tokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};
type OAuthState = { hash: string; expiresAt: string };
type SyncStatus = {
  connected: boolean;
  lastSyncAt?: string;
  lastError?: string;
  totalRecords?: number;
  endpointCounts?: Record<string, number>;
};

type EncryptedPayload = {
  version: 1;
  iv: string;
  tag: string;
  ciphertext: string;
};

async function ensureDirectories() {
  await mkdir(PRIVATE_DIR, { recursive: true, mode: 0o700 });
  await mkdir(RECORDS_DIR, { recursive: true, mode: 0o700 });
}

async function getEncryptionKey() {
  await ensureDirectories();
  try {
    const key = await readFile(KEY_PATH);
    if (key.length !== 32) throw new Error("Invalid Oura storage key");
    return key;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const key = randomBytes(32);
    try {
      await writeFile(KEY_PATH, key, { mode: 0o600, flag: "wx" });
      return key;
    } catch (writeError) {
      if ((writeError as NodeJS.ErrnoException).code !== "EEXIST") throw writeError;
      return readFile(KEY_PATH);
    }
  }
}

async function atomicWrite(filePath: string, value: string, mode = 0o600) {
  const temporaryPath = `${filePath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(temporaryPath, value, { mode });
  await rename(temporaryPath, filePath);
}

async function writeEncrypted(filePath: string, value: unknown) {
  const key = await getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const payload: EncryptedPayload = {
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  await atomicWrite(filePath, JSON.stringify(payload));
}

async function readEncrypted<T>(filePath: string): Promise<T> {
  const key = await getEncryptionKey();
  const payload = JSON.parse(await readFile(filePath, "utf8")) as EncryptedPayload;
  if (payload.version !== 1) throw new Error("Unsupported encrypted Oura file");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8")
  ) as T;
}

export function isLocalRequest(request: Request, allowServiceHost = false) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    (allowServiceHost && host === "nextjs-drives")
  );
}

export async function saveCredentials(credentials: Credentials) {
  await writeEncrypted(CREDENTIALS_PATH, credentials);
}

export async function credentialsAreConfigured() {
  try {
    return (await stat(CREDENTIALS_PATH)).isFile();
  } catch {
    return false;
  }
}

async function loadCredentials() {
  return readEncrypted<Credentials>(CREDENTIALS_PATH);
}

export async function createAuthorizationUrl() {
  const credentials = await loadCredentials();
  const state = randomBytes(32).toString("base64url");
  await saveOAuthState(state);
  const url = new URL("https://cloud.ouraring.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", credentials.clientId);
  url.searchParams.set("redirect_uri", OURA_REDIRECT_URI);
  url.searchParams.set("scope", OURA_SCOPES);
  url.searchParams.set("state", state);
  return url;
}

async function loadTokens() {
  return readEncrypted<Tokens>(TOKENS_PATH);
}

export async function saveOAuthState(state: string) {
  const value: OAuthState = {
    hash: createHash("sha256").update(state).digest("hex"),
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  };
  await writeEncrypted(STATE_PATH, value);
}

export async function consumeOAuthState(state: string) {
  const stored = await readEncrypted<OAuthState>(STATE_PATH);
  const supplied = createHash("sha256").update(state).digest();
  const expected = Buffer.from(stored.hash, "hex");
  const valid =
    supplied.length === expected.length &&
    timingSafeEqual(supplied, expected) &&
    Date.parse(stored.expiresAt) > Date.now();
  if (!valid) throw new Error("The Oura authorization state is invalid or expired");
  await writeEncrypted(STATE_PATH, {
    hash: randomBytes(32).toString("hex"),
    expiresAt: new Date(0).toISOString(),
  });
}

async function requestTokens(parameters: URLSearchParams) {
  const response = await fetch("https://api.ouraring.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: parameters,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Oura token request failed (${response.status})`);
  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!body.access_token || !body.refresh_token) {
    throw new Error("Oura token response was incomplete");
  }
  const tokens: Tokens = {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: new Date(Date.now() + (body.expires_in ?? 86_400) * 1000).toISOString(),
  };
  await writeEncrypted(TOKENS_PATH, tokens);
  return tokens;
}

export async function exchangeAuthorizationCode(code: string) {
  const credentials = await loadCredentials();
  await requestTokens(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: OURA_REDIRECT_URI,
    })
  );
  await writeStatus({ connected: true });
}

async function getAccessToken() {
  const tokens = await loadTokens();
  if (Date.parse(tokens.expiresAt) > Date.now() + 5 * 60_000) return tokens.accessToken;
  const credentials = await loadCredentials();
  const refreshed = await requestTokens(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    })
  );
  return refreshed.accessToken;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDayUtc(daysAgo: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date;
}

const DATE_ENDPOINTS = [
  "daily_activity",
  "daily_sleep",
  "daily_readiness",
  "sleep",
  "sleep_time",
  "workout",
  "daily_spo2",
] as const;

async function fetchCollection(
  endpoint: string,
  initialParameters: Record<string, string>,
  accessToken: string
) {
  const records: unknown[] = [];
  let nextToken: string | undefined;
  do {
    const url = new URL(`https://api.ouraring.com/v2/usercollection/${endpoint}`);
    for (const [key, value] of Object.entries(initialParameters)) {
      url.searchParams.set(key, value);
    }
    if (nextToken) url.searchParams.set("next_token", nextToken);
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`${endpoint} request failed (${response.status})`);
    const body = (await response.json()) as { data?: unknown[]; next_token?: string };
    if (Array.isArray(body.data)) records.push(...body.data);
    nextToken = body.next_token || undefined;
  } while (nextToken);
  return records;
}

async function readStatus(): Promise<SyncStatus> {
  try {
    return JSON.parse(await readFile(STATUS_PATH, "utf8")) as SyncStatus;
  } catch {
    return { connected: false };
  }
}

async function writeStatus(status: SyncStatus) {
  await ensureDirectories();
  await atomicWrite(STATUS_PATH, JSON.stringify(status, null, 2));
}

export async function getPublicStatus() {
  const configured = await credentialsAreConfigured();
  const status = await readStatus();
  let connected = false;
  try {
    connected = (await stat(TOKENS_PATH)).isFile();
  } catch {
    connected = false;
  }
  return {
    configured,
    connected,
    lastSyncAt: status.lastSyncAt,
    lastError: status.lastError,
    totalRecords: status.totalRecords ?? 0,
    endpointCounts: status.endpointCounts ?? {},
  };
}

export async function synchronizeOura() {
  await ensureDirectories();
  const accessToken = await getAccessToken();
  const previous = await readStatus();
  const initialSync = !previous.lastSyncAt;
  const today = new Date();
  const dateStart = startOfDayUtc(initialSync ? 365 : 14);
  const heartRateStart = startOfDayUtc(initialSync ? 30 : 2);
  const endpointCounts: Record<string, number> = {};
  const fetchedAt = new Date().toISOString();
  const archive: Record<string, unknown> = {};

  try {
    for (const endpoint of DATE_ENDPOINTS) {
      const records = await fetchCollection(
        endpoint,
        { start_date: dateOnly(dateStart), end_date: dateOnly(today) },
        accessToken
      );
      archive[endpoint] = records;
      endpointCounts[endpoint] = records.length;
    }
    const heartrate = await fetchCollection(
      "heartrate",
      {
        start_datetime: heartRateStart.toISOString(),
        end_datetime: today.toISOString(),
      },
      accessToken
    );
    archive.heartrate = heartrate;
    endpointCounts.heartrate = heartrate.length;

    const filename = `${fetchedAt.replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}.json`;
    await atomicWrite(
      path.join(RECORDS_DIR, filename),
      JSON.stringify({
        fetched_at: fetchedAt,
        windows: {
          date_start: dateOnly(dateStart),
          date_end: dateOnly(today),
          heartrate_start: heartRateStart.toISOString(),
          heartrate_end: today.toISOString(),
        },
        endpoint_counts: endpointCounts,
        data: archive,
      }),
      0o600
    );
    const totalRecords = Object.values(endpointCounts).reduce((sum, count) => sum + count, 0);
    await writeStatus({
      connected: true,
      lastSyncAt: fetchedAt,
      totalRecords,
      endpointCounts,
    });
    return { lastSyncAt: fetchedAt, totalRecords, endpointCounts };
  } catch (error) {
    const lastError = error instanceof Error ? error.message : "Oura sync failed";
    await writeStatus({ ...previous, connected: true, lastError });
    throw error;
  }
}
