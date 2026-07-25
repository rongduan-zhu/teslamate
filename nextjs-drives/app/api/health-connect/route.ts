import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  getHealthConnectStatus,
  HealthConnectPayloadError,
  isWebhookAuthorized,
  parseHealthConnectPayload,
  storeHealthConnectBatch,
} from "@/lib/health-connect";

export const runtime = "nodejs";

const dataDirectory =
  process.env.HEALTH_CONNECT_DATA_DIR ?? "/app/data/health-connect";

export async function POST(request: NextRequest) {
  const authorizationError = authorize(request);
  if (authorizationError) return authorizationError;

  try {
    const payload = parseHealthConnectPayload(await request.text());

    if (payload.test === true) {
      return NextResponse.json({ status: "ok", test: true });
    }

    const { batch, duplicate } = await storeHealthConnectBatch(payload, dataDirectory);

    return NextResponse.json({
      status: "ok",
      batch_id: batch.batch_id,
      records: batch.record_count,
      sources: batch.source_record_counts,
      duplicate,
    });
  } catch (error) {
    if (error instanceof HealthConnectPayloadError) {
      return NextResponse.json({ status: "error", error: error.message }, { status: 400 });
    }

    console.error("Failed to persist Health Connect webhook batch", error);
    return NextResponse.json(
      { status: "error", error: "Unable to persist webhook data" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const authorizationError = authorize(request);
  if (authorizationError) return authorizationError;

  const status = await getHealthConnectStatus(dataDirectory);
  return NextResponse.json({ status: "ok", ...status });
}

function authorize(request: NextRequest) {
  const expectedToken = process.env.HEALTH_CONNECT_WEBHOOK_TOKEN ?? "";

  if (!expectedToken) {
    return NextResponse.json(
      { status: "error", error: "Health Connect webhook is not configured" },
      { status: 503 }
    );
  }

  const suppliedToken =
    request.nextUrl.searchParams.get("token") ??
    request.headers.get("x-health-connect-token");

  if (!isWebhookAuthorized(expectedToken, suppliedToken)) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
