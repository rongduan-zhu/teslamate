import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { listDrives } from "@/lib/drives";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = parsePositiveInteger(searchParams.get("page"));
  const perPage = parsePositiveInteger(searchParams.get("perPage"));
  const car = searchParams.get("car") ?? undefined;
  const drivesPage = await listDrives({ page, perPage, car });

  return NextResponse.json(drivesPage);
}

function parsePositiveInteger(value: string | null) {
  if (!value) return undefined;
  const integer = Number(value);

  return Number.isInteger(integer) && integer > 0 ? integer : undefined;
}
