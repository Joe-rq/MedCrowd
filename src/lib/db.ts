import { randomUUID } from "crypto";

// Simple file-based storage for hackathon
// In production, replace with a real database

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
}

// In-memory store (sufficient for hackathon demo)
// Data persists within a single server process lifecycle
const users = new Map<string, UserRecord>();
const usersBySecondmeId = new Map<string, string>(); // secondmeId -> id
const consultations = new Map<string, ConsultationRecord>();
const agentResponses = new Map<string, AgentResponseRecord[]>(); // consultationId -> responses

// ---- Users ----

export function upsertUser(data: {
  secondmeId: string;
  name: string;
  avatar: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}): UserRecord {
  const existingId = usersBySecondmeId.get(data.secondmeId);

  if (existingId) {
    const existing = users.get(existingId)!;
    existing.name = data.name;
    existing.avatar = data.avatar;
    existing.accessToken = data.accessToken;
    existing.refreshToken = data.refreshToken;
    existing.tokenExpiry = Date.now() + data.expiresIn * 1000;
    existing.consultable = true; // Reset on login
    existing.circuitBreakerUntil = undefined;
    return existing;
  }

  const user: UserRecord = {
    id: randomUUID(),
    secondmeId: data.secondmeId,
    name: data.name,
    avatar: data.avatar,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    tokenExpiry: Date.now() + data.expiresIn * 1000,
    consultable: true,
    createdAt: Date.now(),
  };

  users.set(user.id, user);
  usersBySecondmeId.set(data.secondmeId, user.id);
  return user;
}

export function getUserById(id: string): UserRecord | undefined {
  return users.get(id);
}

export function getUserBySecondmeId(secondmeId: string): UserRecord | undefined {
  const id = usersBySecondmeId.get(secondmeId);
  return id ? users.get(id) : undefined;
}

export function getConsultableUsers(excludeUserId: string): UserRecord[] {
  const now = Date.now();
  return Array.from(users.values()).filter(
    (u) =>
      u.id !== excludeUserId &&
      u.consultable &&
      (!u.circuitBreakerUntil || u.circuitBreakerUntil < now) &&
      u.tokenExpiry > now
  );
}

export function circuitBreakUser(userId: string, durationMs: number = 30 * 60 * 1000): void {
  const user = users.get(userId);
  if (user) {
    user.circuitBreakerUntil = Date.now() + durationMs;
  }
}

export function updateUserTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): void {
  const user = users.get(userId);
  if (user) {
    user.accessToken = accessToken;
    user.refreshToken = refreshToken;
    user.tokenExpiry = Date.now() + expiresIn * 1000;
  }
}

// ---- Consultations ----

export function createConsultation(askerId: string, question: string): ConsultationRecord {
  const consultation: ConsultationRecord = {
    id: randomUUID(),
    askerId,
    question,
    status: "PENDING",
    agentCount: 0,
    summary: null,
    createdAt: Date.now(),
  };
  consultations.set(consultation.id, consultation);
  agentResponses.set(consultation.id, []);
  return consultation;
}

export function getConsultation(id: string): ConsultationRecord | undefined {
  return consultations.get(id);
}

export function updateConsultation(
  id: string,
  updates: Partial<Pick<ConsultationRecord, "status" | "agentCount" | "summary">>
): void {
  const c = consultations.get(id);
  if (c) {
    Object.assign(c, updates);
  }
}

export function getUserConsultations(userId: string): ConsultationRecord[] {
  return Array.from(consultations.values())
    .filter((c) => c.askerId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ---- Agent Responses ----

export function addAgentResponse(response: AgentResponseRecord): void {
  const list = agentResponses.get(response.consultationId);
  if (list) {
    list.push(response);
  }
}

export function getAgentResponses(consultationId: string): AgentResponseRecord[] {
  return agentResponses.get(consultationId) || [];
}
