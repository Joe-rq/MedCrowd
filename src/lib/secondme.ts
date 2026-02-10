const SECONDME_API_BASE = "https://app.mindos.com/gate/lab";
const OAUTH_BASE = "https://go.second.me/oauth/";

export interface SecondMeTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string[];
}

export interface SecondMeUser {
  userId: string;
  name: string;
  email?: string;
  avatar?: string;
  bio?: string;
}

// Build OAuth authorization URL
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SECONDME_CLIENT_ID!,
    redirect_uri: process.env.SECONDME_REDIRECT_URI!,
    response_type: "code",
    state,
  });
  return `${OAUTH_BASE}?${params.toString()}`;
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(
  code: string
): Promise<SecondMeTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.SECONDME_REDIRECT_URI!,
    client_id: process.env.SECONDME_CLIENT_ID!,
    client_secret: process.env.SECONDME_CLIENT_SECRET!,
  });

  const res = await fetch(`${SECONDME_API_BASE}/api/oauth/token/code`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = await res.json();
  if (json.code !== 0) {
    throw new Error(`Token exchange failed: ${json.message || JSON.stringify(json)}`);
  }

  return json.data;
}

// Refresh access token
export async function refreshAccessToken(
  refreshToken: string
): Promise<SecondMeTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.SECONDME_CLIENT_ID!,
    client_secret: process.env.SECONDME_CLIENT_SECRET!,
  });

  const res = await fetch(`${SECONDME_API_BASE}/api/oauth/token/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = await res.json();
  if (json.code !== 0) {
    throw new Error(`Token refresh failed: ${json.message || JSON.stringify(json)}`);
  }

  return json.data;
}

// Get user info
export async function getUserInfo(
  accessToken: string
): Promise<SecondMeUser> {
  const res = await fetch(`${SECONDME_API_BASE}/api/secondme/user/info`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const json = await res.json();
  if (json.code !== 0) {
    throw new Error(`Get user info failed: ${json.message || JSON.stringify(json)}`);
  }

  return json.data;
}

// Chat with an agent (streaming) - returns full response text
export async function chatWithAgent(
  accessToken: string,
  message: string,
  systemPrompt: string,
  sessionId?: string
): Promise<{ text: string; sessionId: string }> {
  const body: Record<string, unknown> = {
    message,
    systemPrompt,
  };
  if (sessionId) {
    body.sessionId = sessionId;
  }

  const res = await fetch(`${SECONDME_API_BASE}/api/secondme/chat/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const status = res.status;
    const text = await res.text().catch(() => "");
    throw new Error(`Chat API error ${status}: ${text}`);
  }

  // Parse SSE stream
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let fullText = "";
  let resultSessionId = sessionId || "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const dataStr = line.slice(5).trim();
      if (dataStr === "[DONE]") continue;

      try {
        const data = JSON.parse(dataStr);
        if (data.type === "session" && data.sessionId) {
          resultSessionId = data.sessionId;
        }
        if (data.type === "content_delta" || data.type === "delta") {
          fullText += data.content || data.text || "";
        }
        // Handle other possible delta formats
        if (data.choices?.[0]?.delta?.content) {
          fullText += data.choices[0].delta.content;
        }
      } catch {
        // Skip unparseable lines
      }
    }
  }

  return { text: fullText, sessionId: resultSessionId };
}
