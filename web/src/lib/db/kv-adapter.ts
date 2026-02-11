// Vercel KV (Upstash Redis) adapter for production

import { kv } from "@vercel/kv";
import type { DbAdapter } from "./types";

export function createKvAdapter(): DbAdapter {
  return {
    async get<T>(key: string): Promise<T | null> {
      return kv.get<T>(key);
    },

    async set(key: string, value: unknown, options?: { ex?: number }): Promise<void> {
      if (options?.ex) {
        await kv.set(key, value, { ex: options.ex });
      } else {
        await kv.set(key, value);
      }
    },

    async del(key: string): Promise<void> {
      await kv.del(key);
    },

    async sadd(key: string, member: string): Promise<void> {
      await kv.sadd(key, member);
    },

    async srem(key: string, member: string): Promise<void> {
      await kv.srem(key, member);
    },

    async smembers(key: string): Promise<string[]> {
      return kv.smembers(key);
    },

    async lpush(key: string, value: string): Promise<void> {
      await kv.lpush(key, value);
    },

    async lrange(key: string, start: number, stop: number): Promise<string[]> {
      return kv.lrange(key, start, stop);
    },

    async ping(): Promise<void> {
      await kv.ping();
    },
  };
}
