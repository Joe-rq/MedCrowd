// Single agent query with token refresh and timeout

import { chatWithAgent, refreshAccessToken } from "../secondme";
import { circuitBreakUser, updateUserTokens, type UserRecord } from "../db";
import { AGENT_TIMEOUT_MS } from "./prompts";

export async function queryAgent(
  user: UserRecord,
  question: string,
  systemPrompt: string
): Promise<{ text: string; sessionId: string; latencyMs: number } | null> {
  const start = Date.now();

  // Refresh token if expiring soon
  if (user.tokenExpiry < Date.now() + 60_000) {
    try {
      const tokens = await refreshAccessToken(user.refreshToken);
      await updateUserTokens(user.id, tokens.accessToken, tokens.refreshToken, tokens.expiresIn);
      user.accessToken = tokens.accessToken;
    } catch {
      await circuitBreakUser(user.id);
      return null;
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

    const result = await Promise.race([
      chatWithAgent(user.accessToken, question, systemPrompt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), AGENT_TIMEOUT_MS)
      ),
    ]);

    clearTimeout(timeout);
    return { ...result, latencyMs: Date.now() - start };
  } catch (error) {
    console.error(`Agent ${user.id} query failed (${Date.now() - start}ms):`, error);

    if (error instanceof Error && error.message.includes("401")) {
      await circuitBreakUser(user.id);
    }

    return null;
  }
}
