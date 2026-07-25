import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");

  if (error) {
    return new NextResponse(
      renderPage("Oura authorization was not completed", "You can close this window."),
      { status: 400, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  if (!code) {
    return new NextResponse(
      renderPage("Oura callback is ready", "No authorization response was supplied."),
      { headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  return new NextResponse(
    renderPage(
      "Oura authorization received",
      "The secure token exchange will be enabled after the application credentials are installed."
    ),
    { status: 503, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

function renderPage(title: string, message: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="font-family:system-ui,sans-serif;max-width:680px;margin:64px auto;padding:0 20px;line-height:1.6">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character
  );
}
