import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/secondme";
import { randomUUID } from "crypto";
import { setOAuthState } from "@/lib/session";

export async function GET(_request: Request) {
  const state = randomUUID();

  const strictMode = process.env.OAUTH_STATE_STRICT !== "false";

  await setOAuthState(state, strictMode);

  const url = getAuthorizationUrl(state);
  return NextResponse.redirect(url);
}
