// Single agent query with token refresh and timeout

import { chatWithAgent, refreshAccessToken } from "../secondme";
import {
  circuitBreakUser,
  updateUserTokens,
  getUserById,
  acquireLock,
  releaseLock,
  type UserRecord,
} from "../db";
import { AGENT_TIMEOUT_MS } from "./prompts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function refreshTokenWithLock(user: UserRecord): Promise<string | null> {
  const lockKey = `token-refresh:${user.id}`;
  const acquired = await acquireLock(lockKey, 10);

  if (acquired) {
    try {
      const tokens = await refreshAccessToken(user.refreshToken);
      await updateUserTokens(user.id, tokens.accessToken, tokens.refreshToken, tokens.expiresIn);
      return tokens.accessToken;
    } catch {
      await circuitBreakUser(user.id);
      return null;
    } finally {
      await releaseLock(lockKey);
    }
  }

  // Another process is refreshing — wait and read the updated token
  await sleep(200);
  const updated = await getUserById(user.id);
  if (updated && updated.tokenExpiry > Date.now() + 30_000) {
    return updated.accessToken;
  }
  return null;
}

export async function queryAgent(
  user: UserRecord,
  question: string,
  systemPrompt: string
): Promise<{ text: string; sessionId: string; latencyMs: number } | null> {
  const start = Date.now();

  // Refresh token if expiring soon
  if (user.tokenExpiry < Date.now() + 60_000) {
    const newToken = await refreshTokenWithLock(user);
    if (!newToken) return null;
    user.accessToken = newToken;
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
