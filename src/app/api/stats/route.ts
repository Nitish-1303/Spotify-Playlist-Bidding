import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";
import {
  cleanPath,
  cleanReferrer,
  cleanVisitorId,
  readStats,
  recordHit,
} from "@/lib/stats-store";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

let selfHost = "";
try {
  selfHost = new URL(SITE_URL).hostname;
} catch {
  selfHost = "";
}

export async function GET() {
  const stats = await readStats();
  return NextResponse.json(stats, { headers: NO_STORE });
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 2000) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const visitorId = cleanVisitorId(body.visitorId);
  if (!visitorId) {
    return NextResponse.json({ error: "invalid visitorId" }, { status: 400 });
  }

  await recordHit({
    visitorId,
    path: cleanPath(body.path),
    referrer: cleanReferrer(body.referrer, selfHost),
    type: body.type === "view" ? "view" : "ping",
  });

  const stats = await readStats();
  return NextResponse.json(stats, { headers: NO_STORE });
}
