"use client";

import { FormEvent, useEffect, useState } from "react";

type Status = {
  configured: boolean;
  connected: boolean;
  lastSyncAt?: string;
  totalRecords: number;
};

export default function OuraSetupPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    const response = await fetch("/api/oura/status", { cache: "no-store" });
    if (response.ok) setStatus((await response.json()) as Status);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Saving encrypted credentials…");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch("/api/oura/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: form.get("clientId"),
        clientSecret: form.get("clientSecret"),
      }),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setMessage(result.error ?? "Could not save credentials.");
      return;
    }
    formElement.reset();
    setMessage("Credentials are encrypted and saved.");
    await refresh();
  }

  return (
    <>
      <h1>Oura setup</h1>
      <p>
        This page works only on this computer. Credentials and OAuth tokens are
        encrypted before they are stored.
      </p>
      <form onSubmit={save} style={{ display: "grid", gap: 14, maxWidth: 560 }}>
        <label>
          Client ID
          <input
            name="clientId"
            required
            autoComplete="off"
            style={{ display: "block", width: "100%", padding: 10, marginTop: 5 }}
          />
        </label>
        <label>
          Client secret
          <input
            name="clientSecret"
            type="password"
            required
            autoComplete="new-password"
            style={{ display: "block", width: "100%", padding: 10, marginTop: 5 }}
          />
        </label>
        <button type="submit" style={{ padding: 12 }}>Save encrypted credentials</button>
      </form>
      {message && <p role="status">{message}</p>}
      <hr style={{ margin: "32px 0" }} />
      <p>
        Configuration: {status?.configured ? "saved" : "not saved"}<br />
        Oura connection: {status?.connected ? "connected" : "not connected"}<br />
        Last sync: {status?.lastSyncAt ?? "not yet"}<br />
        Records in latest sync: {status?.totalRecords ?? 0}
      </p>
      {status?.configured && !status.connected && (
        <p><a href="/api/oura/connect">Authorize Oura access</a></p>
      )}
      {status?.connected && (
        <button
          type="button"
          onClick={async () => {
            setMessage("Syncing Oura records…");
            const response = await fetch("/api/oura/sync", { method: "POST" });
            setMessage(response.ok ? "Sync completed." : "Sync failed.");
            await refresh();
          }}
          style={{ padding: 12 }}
        >
          Sync now
        </button>
      )}
    </>
  );
}
