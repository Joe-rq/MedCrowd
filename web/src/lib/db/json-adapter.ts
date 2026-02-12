// JSON file adapter for local development

import * as fs from "fs";
import * as path from "path";
import type { DbAdapter } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "medcrowd.db.json");

interface JsonStore {
  kv: Record<string, unknown>;
  sets: Record<string, string[]>;
  lists: Record<string, string[]>;
}

let cache: JsonStore | null = null;

function load(): JsonStore {
  if (cache) return cache;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const data = JSON.parse(raw);
      // Migrate from old format if needed
      if (data.users || data.consultations) {
        const migrated = migrateOldFormat(data);
        cache = migrated;
        persist();
        return migrated;
      }
      cache = data as JsonStore;
      return cache as JsonStore;
    } catch {
      // Corrupted file, start fresh
    }
  }

  cache = { kv: {}, sets: {}, lists: {} };
  return cache;
}

function persist(): void {
  if (cache) {
    fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2), "utf-8");
  }
}

/** Migrate old {users, consultations, agentResponses} format to new adapter format */
function migrateOldFormat(old: Record<string, unknown>): JsonStore {
  const store: JsonStore = { kv: {}, sets: {}, lists: {} };
  const users = (old.users || {}) as Record<string, unknown>;
  const bySecondme = (old.usersBySecondmeId || {}) as Record<string, string>;
  const consultations = (old.consultations || {}) as Record<string, unknown>;
  const responses = (old.agentResponses || {}) as Record<string, unknown>;

  for (const [id, user] of Object.entries(users)) {
    store.kv[`user:${id}`] = user;
  }
  for (const [sid, uid] of Object.entries(bySecondme)) {
    store.kv[`user:secondme:${sid}`] = uid;
  }
  const consultableIds = Object.keys(users);
  store.sets["consultable-users"] = consultableIds;

  for (const [id, c] of Object.entries(consultations)) {
    store.kv[`consultation:${id}`] = c;
  }
  for (const [cid, resps] of Object.entries(responses)) {
    store.kv[`responses:${cid}`] = resps;
  }

  return store;
}

export function resetJsonCache(): void {
  cache = null;
}

export function createJsonAdapter(): DbAdapter {
  return {
    async get<T>(key: string): Promise<T | null> {
      const store = load();
      const val = store.kv[key];
      return (val as T) ?? null;
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async set(key: string, value: unknown, options?: { ex?: number; nx?: boolean }): Promise<boolean | void> {
      const store = load();
      if (options?.nx && store.kv[key] !== undefined) {
        return false; // Key already exists
      }
      store.kv[key] = value;
      persist();
      if (options?.nx) return true;
    },

    async del(key: string): Promise<void> {
      const store = load();
      delete store.kv[key];
      persist();
    },

    async sadd(key: string, member: string): Promise<void> {
      const store = load();
      if (!store.sets[key]) store.sets[key] = [];
      if (!store.sets[key].includes(member)) store.sets[key].push(member);
      persist();
    },

    async srem(key: string, member: string): Promise<void> {
      const store = load();
      if (store.sets[key]) {
        store.sets[key] = store.sets[key].filter((m) => m !== member);
        persist();
      }
    },

    async smembers(key: string): Promise<string[]> {
      return load().sets[key] || [];
    },

    async lpush(key: string, value: string): Promise<void> {
      const store = load();
      if (!store.lists[key]) store.lists[key] = [];
      store.lists[key].unshift(value);
      persist();
    },

    async lrange(key: string, start: number, stop: number): Promise<string[]> {
      const list = load().lists[key] || [];
      const end = stop === -1 ? list.length : stop + 1;
      return list.slice(start, end);
    },

    async ping(): Promise<void> {
      load(); // Just verify we can read the file
    },
  };
}
