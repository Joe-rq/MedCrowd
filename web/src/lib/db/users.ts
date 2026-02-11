// User CRUD operations

import { randomUUID } from "crypto";
import type { DbAdapter } from "./types";
import { KV_KEYS, type UserRecord } from "./types";

export function createUserOps(db: DbAdapter) {
  return {
    async upsertUser(data: {
      secondmeId: string;
      name: string;
      avatar: string;
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }): Promise<UserRecord> {
      const now = Date.now();
      const existingId = await db.get<string>(KV_KEYS.userBySecondme(data.secondmeId));

      if (existingId) {
        const existing = await db.get<UserRecord>(KV_KEYS.user(existingId));
        if (existing) {
          existing.name = data.name;
          existing.avatar = data.avatar;
          existing.accessToken = data.accessToken;
          existing.refreshToken = data.refreshToken;
          existing.tokenExpiry = now + data.expiresIn * 1000;
          existing.consultable = true;
          existing.circuitBreakerUntil = undefined;
          await db.set(KV_KEYS.user(existingId), existing);
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

      await db.set(KV_KEYS.user(user.id), user);
      await db.set(KV_KEYS.userBySecondme(data.secondmeId), user.id);
      await db.sadd(KV_KEYS.consultableUsers(), user.id);
      return user;
    },

    async getUserById(id: string): Promise<UserRecord | undefined> {
      const user = await db.get<UserRecord>(KV_KEYS.user(id));
      return user || undefined;
    },

    async getUserBySecondmeId(secondmeId: string): Promise<UserRecord | undefined> {
      const userId = await db.get<string>(KV_KEYS.userBySecondme(secondmeId));
      if (!userId) return undefined;
      const user = await db.get<UserRecord>(KV_KEYS.user(userId));
      return user || undefined;
    },

    async getConsultableUsers(excludeUserId: string): Promise<UserRecord[]> {
      const now = Date.now();
      const userIds = await db.smembers(KV_KEYS.consultableUsers());
      if (!userIds || userIds.length === 0) return [];

      const users: UserRecord[] = [];
      for (const userId of userIds) {
        const user = await db.get<UserRecord>(KV_KEYS.user(userId));
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
    },

    async circuitBreakUser(userId: string, durationMs: number = 30 * 60 * 1000): Promise<void> {
      const user = await db.get<UserRecord>(KV_KEYS.user(userId));
      if (user) {
        user.circuitBreakerUntil = Date.now() + durationMs;
        await db.set(KV_KEYS.user(userId), user);
        await db.srem(KV_KEYS.consultableUsers(), userId);
      }
    },

    async updateUserTokens(
      userId: string,
      accessToken: string,
      refreshToken: string,
      expiresIn: number
    ): Promise<void> {
      const user = await db.get<UserRecord>(KV_KEYS.user(userId));
      if (user) {
        user.accessToken = accessToken;
        user.refreshToken = refreshToken;
        user.tokenExpiry = Date.now() + expiresIn * 1000;
        await db.set(KV_KEYS.user(userId), user);
      }
    },
  };
}
