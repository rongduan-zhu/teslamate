const endpoint = process.env.OURA_SYNC_URL ?? "http://nextjs-drives:3000/api/oura/sync";
const configuredInterval = Number(process.env.OURA_SYNC_INTERVAL_SECONDS ?? 21600);
const interval = Number.isFinite(configuredInterval)
  ? Math.max(configuredInterval, 900) * 1000
  : 21_600_000;

async function sync() {
  try {
    const response = await fetch(endpoint, { method: "POST" });
    const result = await response.json();
    if (!response.ok) {
      console.error(`Oura sync failed (${response.status}).`);
      return;
    }
    console.log(
      `Oura sync completed at ${result.lastSyncAt}; ${result.totalRecords} records archived.`
    );
  } catch {
    console.error("Oura sync request failed.");
  }
}

await new Promise((resolve) => setTimeout(resolve, 30_000));
while (true) {
  await sync();
  await new Promise((resolve) => setTimeout(resolve, interval));
}
