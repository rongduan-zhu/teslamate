import { NextResponse } from "next/server";
import {
  createAuthorizationUrl,
  credentialsAreConfigured,
  isLocalRequest,
} from "@/lib/oura";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Local authorization only" }, { status: 403 });
  }
  if (!(await credentialsAreConfigured())) {
    return NextResponse.json({ error: "Oura credentials are not configured" }, { status: 409 });
  }

  return NextResponse.redirect(await createAuthorizationUrl());
}
