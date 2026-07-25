import { NextResponse } from "next/server";
import { isLocalRequest, saveCredentials } from "@/lib/oura";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Local setup only" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    clientId?: unknown;
    clientSecret?: unknown;
  } | null;
  const clientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
  const clientSecret =
    typeof body?.clientSecret === "string" ? body.clientSecret.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(clientId)) {
    return NextResponse.json({ error: "Invalid Oura client ID" }, { status: 400 });
  }
  if (clientSecret.length < 20 || clientSecret.length > 500) {
    return NextResponse.json({ error: "Invalid Oura client secret" }, { status: 400 });
  }
  await saveCredentials({ clientId, clientSecret });
  return NextResponse.json({ configured: true });
}
