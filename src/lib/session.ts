import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

const SESSION_COOKIE = "medcrowd_session";
const SESSION_SECRET = process.env.SESSION_SECRET;
const OAUTH_STATE_COOKIE = "medcrowd_oauth_state";

export interface SessionData {
  userId: string;
  secondmeId: string;
  name: string;
  avatar: string;
}

interface SessionStore {
  user?: SessionData;
}

function getSessionOptions() {
  if (!SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required");
  }

  if (SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long");
  }

  return {
    cookieName: SESSION_COOKIE,
    password: SESSION_SECRET,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    },
  };
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionStore>(
    cookieStore,
    getSessionOptions()
  );
  return session.user || null;
}

export async function setSession(data: SessionData): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionStore>(
    cookieStore,
    getSessionOptions()
  );
  session.user = data;
  await session.save();
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionStore>(
    cookieStore,
    getSessionOptions()
  );
  session.destroy();
}

// OAuth State Management
interface OAuthStateData {
  state: string;
  strictMode: boolean;
}

interface OAuthStateStore {
  oauthState?: OAuthStateData;
}

function getOAuthStateOptions() {
  if (!SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required");
  }

  return {
    cookieName: OAUTH_STATE_COOKIE,
    password: SESSION_SECRET,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 10, // 10 minutes - short lived for OAuth flow
      path: "/",
    },
  };
}

export async function setOAuthState(
  state: string,
  strictMode = true
): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<OAuthStateStore>(
    cookieStore,
    getOAuthStateOptions()
  );
  session.oauthState = { state, strictMode };
  await session.save();
}

export async function validateOAuthState(
  receivedState: string
): Promise<{ valid: boolean; error?: string }> {
  const cookieStore = await cookies();
  const session = await getIronSession<OAuthStateStore>(
    cookieStore,
    getOAuthStateOptions()
  );

  const storedState = session.oauthState;

  if (!storedState) {
    return { valid: false, error: "Missing OAuth state - possible CSRF attack" };
  }

  // Clear the state immediately (one-time use)
  session.destroy();

  // Strict mode: exact match required
  if (storedState.strictMode) {
    if (storedState.state !== receivedState) {
      return {
        valid: false,
        error: "Invalid OAuth state - possible CSRF attack",
      };
    }
  } else {
    // Loose mode: allow if not empty (for WebView scenarios)
    if (!receivedState || !storedState.state) {
      return { valid: false, error: "Invalid OAuth state" };
    }
  }

  return { valid: true };
}

export async function clearOAuthState(): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<OAuthStateStore>(
    cookieStore,
    getOAuthStateOptions()
  );
  session.destroy();
}
