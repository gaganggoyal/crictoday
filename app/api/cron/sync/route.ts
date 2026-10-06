import { NextResponse } from "next/server";
import { syncFixtureFiles } from "@/lib/providers/fixture-sync";
import { runImport } from "@/lib/providers/import-job";

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  // A bad fixture file or a failed alert must not stop the provider import.
  const fixtures = await syncFixtureFiles().catch((error: unknown) => ({
    error: error instanceof Error ? error.message : "Fixture sync failed.",
  }));
  const result = await runImport();
  return NextResponse.json({ ...result, fixtures });
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
