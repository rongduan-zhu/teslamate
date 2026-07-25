import { NextRequest, NextResponse } from "next/server";
import { getService } from "@/lib/services";

export const dynamic = "force-dynamic";

const requestHeaders = ["accept", "accept-language", "content-type", "if-match", "if-none-match", "range"];
const responseHeaders = [
  "accept-ranges",
  "cache-control",
  "content-disposition",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
  "location",
  "retry-after",
];

type RouteContext = { params: Promise<{ service: string; path?: string[] }> };

async function forward(request: NextRequest, context: RouteContext) {
  const { service: serviceId, path = [] } = await context.params;
  const service = getService(serviceId);

  if (!service) {
    return NextResponse.json({ error: "Unknown proxy service" }, { status: 404 });
  }

  const relativePath = path.map(encodeURIComponent).join("/");
  const target = new URL(`${service.upstreamUrl}/${relativePath}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  for (const name of requestHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-forwarded-host", request.headers.get("host") ?? "");
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });

    const outgoingHeaders = new Headers();
    for (const name of responseHeaders) {
      const value = upstream.headers.get(name);
      if (value) outgoingHeaders.set(name, value);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outgoingHeaders,
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "Upstream timed out" : "Upstream unavailable";
    return NextResponse.json({ error: message, service: serviceId }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

export const GET = forward;
export const HEAD = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const OPTIONS = forward;
