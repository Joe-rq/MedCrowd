import { randomUUID } from "crypto";
import { kv } from "@vercel/kv";
import * as fs from "fs";
import * as path from "path";

// ============================================================
// 数据库层 - 支持 Vercel KV (生产) 和 JSON 文件 (本地开发)
// ============================================================

// 环境开关：本地开发可回退到 JSON 文件模式
const USE_JSON_MODE = process.env.DB_MODE === "json" || !process.env.KV_REST_API_URL;

// JSON 文件路径（仅本地开发使用）
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "medcrowd.db.json");

// KV Key 规范（幂等键设计）
// user:{id}                -> JSON(UserRecord)
// user:secondme:{sid}      -> string(userId)          // 索引
// consultable-users        -> Set<userId>             // 可咨询用户集合
// consultation:{id}        -> JSON(ConsultationRecord)
// user-consultations:{uid} -> List<consultationId>    // 用户咨询列表索引
// responses:{cid}          -> JSON(AgentResponseRecord[])
// response-idempotent:{consultationId}:{round}:{agentId} -> string(responseId) // 幂等控制

interface Database {
  users: Record<string, UserRecord>;
  usersBySecondmeId: Record<string, string>; // secondmeId -> user id
  consultations: Record<string, ConsultationRecord>;
  agentResponses: Record<string, AgentResponseRecord[]>; // consultationId -> responses
}

// ============================================================
// JSON 文件模式（本地开发）
// ============================================================

function initJSONDatabase(): Database {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    } catch {
      // If file is corrupted, start fresh
    }
  }

  return {
    users: {},
    usersBySecondmeId: {},
    consultations: {},
    agentResponses: {},
  };
}

function loadJSONDB(): Database {
  return initJSONDatabase();
}

function saveJSONDB(db: Database): void {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

// In-memory cache for JSON mode
let jsonCache: Database | null = null;

function getJSONCache(): Database {
  if (!jsonCache) {
    jsonCache = loadJSONDB();
  }
  return jsonCache;
}

function persistJSON(): void {
  saveJSONDB(getJSONCache());
}

/**
 * 重置 JSON 缓存（测试用）
 */
export function resetJSONCache(): void {
  jsonCache = null;
}

// ============================================================
// 数据模型定义
// ============================================================

export interface UserRecord {
  id: string;
  secondmeId: string;
  name: string;
  avatar: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number; // Unix timestamp ms
  consultable: boolean;
  circuitBreakerUntil?: number; // Unix timestamp ms - temporary disable
  createdAt: number;
}

export interface ConsultationRecord {
  id: string;
  askerId: string;
  question: string;
  status: "PENDING" | "CONSULTING" | "DONE" | "FAILED";
  agentCount: number;
  summary: Record<string, unknown> | null;
  triage: Record<string, unknown> | null;
  createdAt: number;
}

export interface AgentResponseRecord {
  id: string;
  consultationId: string;
  responderId: string;
  sessionId: string;
  rawResponse: string;
  keyPoints: string[];
  isValid: boolean;
  invalidReason?: string;
  latencyMs: number;
  createdAt: number;
  round?: "initial" | "reaction"; // 反应轮支持
}

// ============================================================
// KV Key 生成器（集中管理 key schema）
// ============================================================

const KV_KEYS = {
  user: (userId: string) => `user:${userId}`,
  userBySecondme: (secondmeId: string) => `user:secondme:${secondmeId}`,
  consultableUsers: () => "consultable-users",
  consultation: (consultationId: string) => `consultation:${consultationId}`,
  userConsultations: (userId: string) => `user-consultations:${userId}`,
  responses: (consultationId: string) => `responses:${consultationId}`,
  // 幂等键规范：consultation:{id}:round:{round}:agent:{agentId}
  idempotent: (consultationId: string, round: number, agentId: string) =>
    `consultation:${consultationId}:round:${round}:agent:${agentId}`,
};

// ============================================================
// Users - 异步函数
// ============================================================

export async function upsertUser(data: {
  secondmeId: string;
  name: string;
  avatar: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}): Promise<UserRecord> {
  const now = Date.now();

  if (USE_JSON_MODE) {
    const db = getJSONCache();
    const existingId = db.usersBySecondmeId[data.secondmeId];

    if (existingId) {
      const existing = db.users[existingId];
      existing.name = data.name;
      existing.avatar = data.avatar;
      existing.accessToken = data.accessToken;
      existing.refreshToken = data.refreshToken;
      existing.tokenExpiry = now + data.expiresIn * 1000;
      existing.consultable = true;
      existing.circuitBreakerUntil = undefined;
      persistJSON();
      return existing;
    }

    const user: UserRecord = {
      id: randomUUID(),
      secondmeId: data.secondmeId,
      name: data.name,
      avatar: data.avatar,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      tokenExpiry: now + data.expiresIn * 1000,
      consultable: true,
      createdAt: now,
    };

    db.users[user.id] = user;
    db.usersBySecondmeId[data.secondmeId] = user.id;
    persistJSON();
    return user;
  }

  // KV 模式
  const existingId = await kv.get<string>(KV_KEYS.userBySecondme(data.secondmeId));

  if (existingId) {
    const existing = await kv.get<UserRecord>(KV_KEYS.user(existingId));
    if (existing) {
      existing.name = data.name;
      existing.avatar = data.avatar;
      existing.accessToken = data.accessToken;
      existing.refreshToken = data.refreshToken;
      existing.tokenExpiry = now + data.expiresIn * 1000;
      existing.consultable = true;
      existing.circuitBreakerUntil = undefined;
      await kv.set(KV_KEYS.user(existingId), existing);
      return existing;
    }
  }

  const user: UserRecord = {
    id: randomUUID(),
    secondmeId: data.secondmeId,
    name: data.name,
    avatar: data.avatar,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    tokenExpiry: now + data.expiresIn * 1000,
    consultable: true,
    createdAt: now,
  };

  await kv.set(KV_KEYS.user(user.id), user);
  await kv.set(KV_KEYS.userBySecondme(data.secondmeId), user.id);
  await kv.sadd(KV_KEYS.consultableUsers(), user.id);
  return user;
}

export async function getUserById(id: string): Promise<UserRecord | undefined> {
  if (USE_JSON_MODE) {
    return getJSONCache().users[id];
  }
  const user = await kv.get<UserRecord>(KV_KEYS.user(id));
  return user || undefined;
}

export async function getUserBySecondmeId(secondmeId: string): Promise<UserRecord | undefined> {
  if (USE_JSON_MODE) {
    const id = getJSONCache().usersBySecondmeId[secondmeId];
    return id ? getJSONCache().users[id] : undefined;
  }

  const userId = await kv.get<string>(KV_KEYS.userBySecondme(secondmeId));
  if (!userId) return undefined;
  const user = await kv.get<UserRecord>(KV_KEYS.user(userId));
  return user || undefined;
}

export async function getConsultableUsers(excludeUserId: string): Promise<UserRecord[]> {
  const now = Date.now();

  if (USE_JSON_MODE) {
    return Object.values(getJSONCache().users).filter(
      (u) =>
        u.id !== excludeUserId &&
        u.consultable &&
        (!u.circuitBreakerUntil || u.circuitBreakerUntil < now) &&
        u.tokenExpiry > now
    );
  }

  const userIds = await kv.smembers(KV_KEYS.consultableUsers());
  if (!userIds || userIds.length === 0) return [];

  const users: UserRecord[] = [];
  for (const userId of userIds) {
    const user = await kv.get<UserRecord>(KV_KEYS.user(userId));
    if (
      user &&
      user.id !== excludeUserId &&
      user.consultable &&
      (!user.circuitBreakerUntil || user.circuitBreakerUntil < now) &&
      user.tokenExpiry > now
    ) {
      users.push(user);
    }
  }
  return users;
}

export async function circuitBreakUser(userId: string, durationMs: number = 30 * 60 * 1000): Promise<void> {
  const until = Date.now() + durationMs;

  if (USE_JSON_MODE) {
    const user = getJSONCache().users[userId];
    if (user) {
      user.circuitBreakerUntil = until;
      persistJSON();
    }
    return;
  }

  const user = await kv.get<UserRecord>(KV_KEYS.user(userId));
  if (user) {
    user.circuitBreakerUntil = until;
    await kv.set(KV_KEYS.user(userId), user);
    // 从可咨询集合中移除
    await kv.srem(KV_KEYS.consultableUsers(), userId);
  }
}

export async function updateUserTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): Promise<void> {
  const expiry = Date.now() + expiresIn * 1000;

  if (USE_JSON_MODE) {
    const user = getJSONCache().users[userId];
    if (user) {
      user.accessToken = accessToken;
      user.refreshToken = refreshToken;
      user.tokenExpiry = expiry;
      persistJSON();
    }
    return;
  }

  const user = await kv.get<UserRecord>(KV_KEYS.user(userId));
  if (user) {
    user.accessToken = accessToken;
    user.refreshToken = refreshToken;
    user.tokenExpiry = expiry;
    await kv.set(KV_KEYS.user(userId), user);
  }
}

// ============================================================
// Consultations - 异步函数
// ============================================================

export async function createConsultation(askerId: string, question: string): Promise<ConsultationRecord> {
  const now = Date.now();
  const consultation: ConsultationRecord = {
    id: randomUUID(),
    askerId,
    question,
    status: "PENDING",
    agentCount: 0,
    summary: null,
    triage: null,
    createdAt: now,
  };

  if (USE_JSON_MODE) {
    const db = getJSONCache();
    db.consultations[consultation.id] = consultation;
    db.agentResponses[consultation.id] = [];
    persistJSON();
    return consultation;
  }

  await kv.set(KV_KEYS.consultation(consultation.id), consultation);
  await kv.set(KV_KEYS.responses(consultation.id), []);
  await kv.lpush(KV_KEYS.userConsultations(askerId), consultation.id);
  return consultation;
}

export async function getConsultation(id: string): Promise<ConsultationRecord | undefined> {
  if (USE_JSON_MODE) {
    return getJSONCache().consultations[id];
  }
  const consultation = await kv.get<ConsultationRecord>(KV_KEYS.consultation(id));
  return consultation || undefined;
}

export async function updateConsultation(
  id: string,
  updates: Partial<Pick<ConsultationRecord, "status" | "agentCount" | "summary" | "triage">>
): Promise<void> {
  if (USE_JSON_MODE) {
    const c = getJSONCache().consultations[id];
    if (c) {
      Object.assign(c, updates);
      persistJSON();
    }
    return;
  }

  const c = await kv.get<ConsultationRecord>(KV_KEYS.consultation(id));
  if (c) {
    Object.assign(c, updates);
    await kv.set(KV_KEYS.consultation(id), c);
  }
}

export async function getUserConsultations(userId: string): Promise<ConsultationRecord[]> {
  if (USE_JSON_MODE) {
    return Object.values(getJSONCache().consultations)
      .filter((c) => c.askerId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  const consultationIds = await kv.lrange<string>(KV_KEYS.userConsultations(userId), 0, -1);
  if (!consultationIds || consultationIds.length === 0) return [];

  const consultations: ConsultationRecord[] = [];
  for (const id of consultationIds) {
    const c = await kv.get<ConsultationRecord>(KV_KEYS.consultation(id));
    if (c) consultations.push(c);
  }
  return consultations.sort((a, b) => b.createdAt - a.createdAt);
}

// ============================================================
// Agent Responses - 异步函数
// ============================================================

/**
 * 添加 Agent 响应（带幂等性控制）
 * 幂等键规范：consultation:{id}:round:{round}:agent:{agentId}
 */
export async function addAgentResponse(
  response: AgentResponseRecord,
  round: number = 0
): Promise<void> {
  const idempotentKey = KV_KEYS.idempotent(response.consultationId, round, response.responderId);

  if (USE_JSON_MODE) {
    const db = getJSONCache();
    const list = db.agentResponses[response.consultationId];
    if (list) {
      // 简单幂等：检查是否已存在同 consultation + round + responder 的响应
      // round 参数映射到 response.round 字段：0 -> "initial", 1+ -> "reaction"
      const expectedRound = round === 0 ? "initial" : "reaction";
      const existingIndex = list.findIndex(
        (r) => r.responderId === response.responderId && r.round === expectedRound
      );
      if (existingIndex === -1) {
        // 设置 round 字段以确保一致性
        response.round = expectedRound;
        list.push(response);
        persistJSON();
      }
    }
    return;
  }

  // KV 模式：使用幂等键检查
  const existingId = await kv.get<string>(idempotentKey);
  if (existingId) {
    return; // 已存在，跳过
  }

  // 设置幂等键（10分钟过期，与咨询生命周期匹配）
  await kv.set(idempotentKey, response.id, { ex: 600 });

  // 添加响应到列表
  const responses = await kv.get<AgentResponseRecord[]>(KV_KEYS.responses(response.consultationId)) || [];
  responses.push(response);
  await kv.set(KV_KEYS.responses(response.consultationId), responses);
}

/**
 * 批量添加 Agent 响应（带幂等性控制 + 失败隔离）
 * 返回每个响应的写入结果，失败不抛异常
 */
export async function addAgentResponsesBatch(
  responses: Array<{ response: AgentResponseRecord; round?: number }>
): Promise<Array<{ success: boolean; responseId: string; error?: string }>> {
  const results: Array<{ success: boolean; responseId: string; error?: string }> = [];

  if (USE_JSON_MODE) {
    const db = getJSONCache();
    for (const { response, round = 0 } of responses) {
      try {
        const list = db.agentResponses[response.consultationId];
        if (list) {
          const expectedRound = round === 0 ? "initial" : "reaction";
          const existingIndex = list.findIndex(
            (r) => r.responderId === response.responderId && r.round === expectedRound
          );
          if (existingIndex === -1) {
            // 深拷贝响应对象，防止外部修改影响存储的数据
            const responseCopy: AgentResponseRecord = { ...response, round: expectedRound as "initial" | "reaction" };
            list.push(responseCopy);
          }
          // 如果已存在，跳过（保持幂等性）
        }
        results.push({ success: true, responseId: response.id });
      } catch (error) {
        results.push({
          success: false,
          responseId: response.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    // 一次性持久化所有成功的写入
    persistJSON();
    return results;
  }

  const writePromises = responses.map(async ({ response, round = 0 }) => {
    try {
      const idempotentKey = KV_KEYS.idempotent(response.consultationId, round, response.responderId);
      const [existingId, existingResponses] = await Promise.all([
        kv.get<string>(idempotentKey),
        kv.get<AgentResponseRecord[]>(KV_KEYS.responses(response.consultationId)),
      ]);

      if (existingId) {
        return { success: true, responseId: response.id, skipped: true as const };
      }

      const expectedRound = round === 0 ? "initial" : "reaction";
      const alreadyInList = (existingResponses || []).some(
        (r) => r.responderId === response.responderId && r.round === expectedRound
      );
      if (alreadyInList) {
        await kv.set(idempotentKey, response.id, { ex: 600 });
        return { success: true, responseId: response.id, skipped: true as const };
      }

      await kv.set(idempotentKey, response.id, { ex: 600 });
      const updatedResponses = [...(existingResponses || []), response];
      await kv.set(KV_KEYS.responses(response.consultationId), updatedResponses);

      return { success: true, responseId: response.id, skipped: false as const };
    } catch (error) {
      return {
        success: false,
        responseId: response.id,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const settled = await Promise.allSettled(writePromises);
  return settled.map((result) => {
    if (result.status === "fulfilled") {
      return { success: result.value.success, responseId: result.value.responseId, error: (result.value as { error?: string }).error };
    }
    return { success: false, responseId: "unknown", error: result.reason };
  });
}

export async function getAgentResponses(consultationId: string): Promise<AgentResponseRecord[]> {
  if (USE_JSON_MODE) {
    return getJSONCache().agentResponses[consultationId] || [];
  }
  const responses = await kv.get<AgentResponseRecord[]>(KV_KEYS.responses(consultationId));
  return responses || [];
}

// ============================================================
// 工具函数 / 健康检查
// ============================================================

/**
 * 检查 KV 连接健康状态
 */
export async function checkDBHealth(): Promise<{ healthy: boolean; mode: string; error?: string }> {
  if (USE_JSON_MODE) {
    return { healthy: true, mode: "json" };
  }

  try {
    await kv.ping();
    return { healthy: true, mode: "kv" };
  } catch (error) {
    return {
      healthy: false,
      mode: "kv",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 获取当前数据库模式
 */
export function getDBMode(): "json" | "kv" {
  return USE_JSON_MODE ? "json" : "kv";
}
