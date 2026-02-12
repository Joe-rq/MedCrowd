// Demo mode flag - when enabled, returns mock responses instead of calling real API
const DEMO_MODE = process.env.DEMO_MODE === "true";

// Demo responses for testing without SecondMe API
const DEMO_RESPONSES = [
  "根据我主人的经验，这种情况确实需要注意。建议先观察一周，如果症状持续就去医院检查。",
  "我主人之前也遇到过类似情况，去医院做了血常规和B超，花了大概300-500元，最后发现是虚惊一场。",
  "建议空腹去检查，记得带上医保卡和之前的病历。如果做B超可能需要憋尿。",
  "这个要看具体情况，我主人建议先挂个普通号咨询，不需要直接挂专家号，能省不少钱。",
  "我主人提醒：如果有发热或者剧烈疼痛，建议不要拖，尽快就医。",
];

export function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value && !DEMO_MODE) {
    throw new Error(`${name} is required. Set it in .env.local`);
  }
  return value || "";
}

function getSecondMeApiBase(): string {
  return getRequiredEnvVar("SECONDME_API_BASE_URL");
}

function getSecondMeOAuthUrl(): string {
  return getRequiredEnvVar("SECONDME_OAUTH_URL");
}

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
  return `${getSecondMeOAuthUrl()}?${params.toString()}`;
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

  const res = await fetch(`${getSecondMeApiBase()}/api/oauth/token/code`, {
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

  const res = await fetch(`${getSecondMeApiBase()}/api/oauth/token/refresh`, {
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
  const res = await fetch(`${getSecondMeApiBase()}/api/secondme/user/info`, {
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
  sessionId?: string,
  signal?: AbortSignal
): Promise<{ text: string; sessionId: string }> {
  if (DEMO_MODE) {
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));
    const randomResponse = DEMO_RESPONSES[Math.floor(Math.random() * DEMO_RESPONSES.length)];
    return {
      text: randomResponse,
      sessionId: sessionId || `demo-${Date.now()}`,
    };
  }

  const body: Record<string, unknown> = {
    message,
    systemPrompt,
  };
  if (sessionId) {
    body.sessionId = sessionId;
  }

  const res = await fetch(`${getSecondMeApiBase()}/api/secondme/chat/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const status = res.status;
    const text = await res.text().catch(() => "");
    throw new Error(`Chat API error ${status}: ${text}`);
  }

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
        if (data.choices?.[0]?.delta?.content) {
          fullText += data.choices[0].delta.content;
        }
      } catch {
      }
    }
  }

  return { text: fullText, sessionId: resultSessionId };
}
