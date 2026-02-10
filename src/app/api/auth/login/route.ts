import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/secondme";
import { randomUUID } from "crypto";

export async function GET() {
  const state = randomUUID();
  const url = getAuthorizationUrl(state);
  return NextResponse.redirect(url);
}
