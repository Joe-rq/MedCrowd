import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";

// SQLite-like file-based storage for persistence
// Data persists across server restarts

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "medcrowd.db.json");

interface Database {
  users: Record<string, UserRecord>;
  usersBySecondmeId: Record<string, string>; // secondmeId -> user id
  consultations: Record<string, ConsultationRecord>;
  agentResponses: Record<string, AgentResponseRecord[]>; // consultationId -> responses
}

// Initialize database file
function initDatabase(): Database {
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

// Load database from disk
function loadDB(): Database {
  return initDatabase();
}

// Save database to disk (synchronous)
function saveDB(db: Database): void {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

// In-memory cache for performance (loaded from disk on startup)
const dbCache: Database = loadDB();

// Persist changes immediately
function persist(): void {
  saveDB(dbCache);
}

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
}

// ---- Users ----

export function upsertUser(data: {
  secondmeId: string;
  name: string;
  avatar: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}): UserRecord {
  const existingId = dbCache.usersBySecondmeId[data.secondmeId];

  if (existingId) {
    const existing = dbCache.users[existingId];
    existing.name = data.name;
    existing.avatar = data.avatar;
    existing.accessToken = data.accessToken;
    existing.refreshToken = data.refreshToken;
    existing.tokenExpiry = Date.now() + data.expiresIn * 1000;
    existing.consultable = true; // Reset on login
    existing.circuitBreakerUntil = undefined;
    persist();
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

  dbCache.users[user.id] = user;
  dbCache.usersBySecondmeId[data.secondmeId] = user.id;
  persist();
  return user;
}

export function getUserById(id: string): UserRecord | undefined {
  return dbCache.users[id];
}

export function getUserBySecondmeId(secondmeId: string): UserRecord | undefined {
  const id = dbCache.usersBySecondmeId[secondmeId];
  return id ? dbCache.users[id] : undefined;
}

export function getConsultableUsers(excludeUserId: string): UserRecord[] {
  const now = Date.now();
  return Object.values(dbCache.users).filter(
    (u) =>
      u.id !== excludeUserId &&
      u.consultable &&
      (!u.circuitBreakerUntil || u.circuitBreakerUntil < now) &&
      u.tokenExpiry > now
  );
}

export function circuitBreakUser(userId: string, durationMs: number = 30 * 60 * 1000): void {
  const user = dbCache.users[userId];
  if (user) {
    user.circuitBreakerUntil = Date.now() + durationMs;
    persist();
  }
}

export function updateUserTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): void {
  const user = dbCache.users[userId];
  if (user) {
    user.accessToken = accessToken;
    user.refreshToken = refreshToken;
    user.tokenExpiry = Date.now() + expiresIn * 1000;
    persist();
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
    triage: null,
    createdAt: Date.now(),
  };
  dbCache.consultations[consultation.id] = consultation;
  dbCache.agentResponses[consultation.id] = [];
  persist();
  return consultation;
}

export function getConsultation(id: string): ConsultationRecord | undefined {
  return dbCache.consultations[id];
}

export function updateConsultation(
  id: string,
  updates: Partial<Pick<ConsultationRecord, "status" | "agentCount" | "summary" | "triage">>
): void {
  const c = dbCache.consultations[id];
  if (c) {
    Object.assign(c, updates);
    persist();
  }
}

export function getUserConsultations(userId: string): ConsultationRecord[] {
  return Object.values(dbCache.consultations)
    .filter((c) => c.askerId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ---- Agent Responses ----

export function addAgentResponse(response: AgentResponseRecord): void {
  const list = dbCache.agentResponses[response.consultationId];
  if (list) {
    list.push(response);
    persist();
  }
}

export function getAgentResponses(consultationId: string): AgentResponseRecord[] {
  return dbCache.agentResponses[consultationId] || [];
}
