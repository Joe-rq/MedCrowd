import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/secondme";
import { randomUUID } from "crypto";
import { setOAuthState } from "@/lib/session";

export async function GET(_request: Request) {
  const state = randomUUID();

  await setOAuthState(state);

  const url = getAuthorizationUrl(state);
  return NextResponse.redirect(url);
}
