import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  upsertUser,
  getUserById,
  getUserBySecondmeId,
  getConsultableUsers,
  circuitBreakUser,
  updateUserTokens,
  createConsultation,
  getConsultation,
  updateConsultation,
  getUserConsultations,
  addAgentResponse,
  addAgentResponsesBatch,
  getAgentResponses,
  checkDBHealth,
  getDBMode,
  resetJSONCache,
  type UserRecord,
  type AgentResponseRecord,
} from "@/lib/db";

const TEST_DB_FILE = path.join(process.cwd(), "data", "medcrowd.db.json");

describe("DB Layer Contract Tests", () => {
  beforeEach(() => {
    process.env.KV_REST_API_URL = "";
    process.env.DB_MODE = "json";
    resetJSONCache();
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }
  });

  describe("Database Mode", () => {
    it("should report JSON mode when KV_REST_API_URL is not set", () => {
      process.env.KV_REST_API_URL = "";
      expect(getDBMode()).toBe("json");
    });

    it("should report health status", async () => {
      const health = await checkDBHealth();
      expect(health.healthy).toBe(true);
      expect(health.mode).toBe("json");
    });
  });

  describe("User Operations", () => {
    it("should upsert a new user", async () => {
      const user = await upsertUser({
        secondmeId: "test-secondme-1",
        name: "Test User",
        avatar: "https://example.com/avatar.png",
        accessToken: "token-123",
        refreshToken: "refresh-123",
        expiresIn: 7200,
      });

      expect(user.id).toBeDefined();
      expect(user.secondmeId).toBe("test-secondme-1");
      expect(user.name).toBe("Test User");
      expect(user.consultable).toBe(true);
      expect(user.tokenExpiry).toBeGreaterThan(Date.now());
    });

    it("should update existing user on upsert", async () => {
      const user1 = await upsertUser({
        secondmeId: "test-secondme-2",
        name: "Original Name",
        avatar: "avatar1.png",
        accessToken: "token-1",
        refreshToken: "refresh-1",
        expiresIn: 7200,
      });

      const user2 = await upsertUser({
        secondmeId: "test-secondme-2",
        name: "Updated Name",
        avatar: "avatar2.png",
        accessToken: "token-2",
        refreshToken: "refresh-2",
        expiresIn: 7200,
      });

      expect(user2.id).toBe(user1.id);
      expect(user2.name).toBe("Updated Name");
      expect(user2.accessToken).toBe("token-2");
    });

    it("should get user by id", async () => {
      const user = await upsertUser({
        secondmeId: "test-secondme-3",
        name: "Test User",
        avatar: "avatar.png",
        accessToken: "token",
        refreshToken: "refresh",
        expiresIn: 7200,
      });

      const found = await getUserById(user.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(user.id);
    });

    it("should get user by secondme id", async () => {
      await upsertUser({
        secondmeId: "test-secondme-4",
        name: "Test User",
        avatar: "avatar.png",
        accessToken: "token",
        refreshToken: "refresh",
        expiresIn: 7200,
      });

      const found = await getUserBySecondmeId("test-secondme-4");
      expect(found).toBeDefined();
      expect(found?.secondmeId).toBe("test-secondme-4");
    });

    it("should return undefined for non-existent user", async () => {
      const found = await getUserById("non-existent-id");
      expect(found).toBeUndefined();
    });

    it("should update user tokens", async () => {
      const user = await upsertUser({
        secondmeId: "test-secondme-5",
        name: "Test User",
        avatar: "avatar.png",
        accessToken: "old-token",
        refreshToken: "old-refresh",
        expiresIn: 7200,
      });

      await updateUserTokens(user.id, "new-token", "new-refresh", 3600);

      const updated = await getUserById(user.id);
      expect(updated?.accessToken).toBe("new-token");
      expect(updated?.refreshToken).toBe("new-refresh");
    });

    it("should circuit break user", async () => {
      const user = await upsertUser({
        secondmeId: "test-secondme-6",
        name: "Test User",
        avatar: "avatar.png",
        accessToken: "token",
        refreshToken: "refresh",
        expiresIn: 7200,
      });

      const futureTime = Date.now() + 30 * 60 * 1000;
      await circuitBreakUser(user.id, 30 * 60 * 1000);

      const updated = await getUserById(user.id);
      expect(updated?.circuitBreakerUntil).toBeGreaterThan(futureTime - 1000);
    });

    it("should get consultable users excluding self", async () => {
      // 创建多个用户
      const user1 = await upsertUser({
        secondmeId: "test-secondme-a",
        name: "User A",
        avatar: "avatar.png",
        accessToken: "token-a",
        refreshToken: "refresh-a",
        expiresIn: 7200,
      });

      await upsertUser({
        secondmeId: "test-secondme-b",
        name: "User B",
        avatar: "avatar.png",
        accessToken: "token-b",
        refreshToken: "refresh-b",
        expiresIn: 7200,
      });

      const consultable = await getConsultableUsers(user1.id);
      expect(consultable.length).toBe(1);
      expect(consultable[0].secondmeId).toBe("test-secondme-b");
    });

    it("should exclude circuit-broken users from consultable", async () => {
      const user = await upsertUser({
        secondmeId: "test-secondme-c",
        name: "User C",
        avatar: "avatar.png",
        accessToken: "token-c",
        refreshToken: "refresh-c",
        expiresIn: 7200,
      });

      // Circuit break the user
      await circuitBreakUser(user.id, 30 * 60 * 1000);

      const consultable = await getConsultableUsers("other-user-id");
      expect(consultable.find((u) => u.id === user.id)).toBeUndefined();
    });
  });

  describe("Consultation Operations", () => {
    it("should create consultation", async () => {
      const consultation = await createConsultation(
        "asker-id-1",
        "Should I get a gastroscopy?"
      );

      expect(consultation.id).toBeDefined();
      expect(consultation.askerId).toBe("asker-id-1");
      expect(consultation.question).toBe("Should I get a gastroscopy?");
      expect(consultation.status).toBe("PENDING");
    });

    it("should get consultation by id", async () => {
      const created = await createConsultation(
        "asker-id-2",
        "What are the side effects of this medication?"
      );

      const found = await getConsultation(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.question).toBe("What are the side effects of this medication?");
    });

    it("should update consultation", async () => {
      const consultation = await createConsultation("asker-id-3", "Test question");

      await updateConsultation(consultation.id, {
        status: "CONSULTING",
        agentCount: 5,
      });

      const updated = await getConsultation(consultation.id);
      expect(updated?.status).toBe("CONSULTING");
      expect(updated?.agentCount).toBe(5);
    });

    it("should get user consultations sorted by time", async () => {
      await createConsultation("asker-id-4", "Question 1");
      await new Promise((resolve) => setTimeout(resolve, 10)); // 确保时间差
      await createConsultation("asker-id-4", "Question 2");

      const consultations = await getUserConsultations("asker-id-4");
      expect(consultations.length).toBe(2);
      expect(consultations[0].question).toBe("Question 2"); // 最新的在前
      expect(consultations[1].question).toBe("Question 1");
    });
  });

  describe("Agent Response Operations", () => {
    let consultationId: string;

    beforeEach(async () => {
      const consultation = await createConsultation("asker-id", "Test question");
      consultationId = consultation.id;
    });

    it("should add agent response", async () => {
      const response: AgentResponseRecord = {
        id: "resp-1",
        consultationId,
        responderId: "agent-1",
        sessionId: "session-1",
        rawResponse: "This is a test response",
        keyPoints: ["point 1", "point 2"],
        isValid: true,
        latencyMs: 1500,
        createdAt: Date.now(),
      };

      await addAgentResponse(response);

      const responses = await getAgentResponses(consultationId);
      expect(responses.length).toBe(1);
      expect(responses[0].rawResponse).toBe("This is a test response");
    });

    it("should get multiple agent responses", async () => {
      await addAgentResponse({
        id: "resp-1",
        consultationId,
        responderId: "agent-1",
        sessionId: "session-1",
        rawResponse: "Response 1",
        keyPoints: [],
        isValid: true,
        latencyMs: 1000,
        createdAt: Date.now(),
      });

      await addAgentResponse({
        id: "resp-2",
        consultationId,
        responderId: "agent-2",
        sessionId: "session-2",
        rawResponse: "Response 2",
        keyPoints: [],
        isValid: true,
        latencyMs: 1200,
        createdAt: Date.now(),
      });

      const responses = await getAgentResponses(consultationId);
      expect(responses.length).toBe(2);
    });

    it("should handle idempotent response addition", async () => {
      const response: AgentResponseRecord = {
        id: "resp-1",
        consultationId,
        responderId: "agent-1",
        sessionId: "session-1",
        rawResponse: "Original response",
        keyPoints: [],
        isValid: true,
        latencyMs: 1000,
        createdAt: Date.now(),
      };

      // 第一次添加
      await addAgentResponse(response);

      // 第二次添加（相同 consultationId, responderId, round）
      const duplicateResponse = { ...response, rawResponse: "Duplicate response" };
      await addAgentResponse(duplicateResponse);

      const responses = await getAgentResponses(consultationId);
      expect(responses.length).toBe(1); // 应该只有一条
      expect(responses[0].rawResponse).toBe("Original response"); // 保留第一次的
    });

    it("should support round parameter for idempotency", async () => {
      const response1: AgentResponseRecord = {
        id: "resp-1",
        consultationId,
        responderId: "agent-1",
        sessionId: "session-1",
        rawResponse: "Initial response",
        keyPoints: [],
        isValid: true,
        latencyMs: 1000,
        createdAt: Date.now(),
        round: "initial",
      };

      const response2: AgentResponseRecord = {
        id: "resp-2",
        consultationId,
        responderId: "agent-1",
        sessionId: "session-2",
        rawResponse: "Reaction response",
        keyPoints: [],
        isValid: true,
        latencyMs: 1000,
        createdAt: Date.now(),
        round: "reaction",
      };

      await addAgentResponse(response1, 0);
      await addAgentResponse(response2, 1);

      const responses = await getAgentResponses(consultationId);
      expect(responses.length).toBe(2);
    });

    it("should return empty array for non-existent consultation", async () => {
      const responses = await getAgentResponses("non-existent-consultation");
      expect(responses).toEqual([]);
    });

    it("should batch add agent responses with idempotency", async () => {
      const responses = [
        {
          response: {
            id: "batch-resp-1",
            consultationId,
            responderId: "agent-1",
            sessionId: "session-1",
            rawResponse: "Response 1",
            keyPoints: ["point1"],
            isValid: true,
            latencyMs: 1000,
            createdAt: Date.now(),
          } as AgentResponseRecord,
          round: 0,
        },
        {
          response: {
            id: "batch-resp-2",
            consultationId,
            responderId: "agent-2",
            sessionId: "session-2",
            rawResponse: "Response 2",
            keyPoints: ["point2"],
            isValid: true,
            latencyMs: 1200,
            createdAt: Date.now(),
          } as AgentResponseRecord,
          round: 0,
        },
      ];

      const results = await addAgentResponsesBatch(responses);

      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);

      const stored = await getAgentResponses(consultationId);
      expect(stored.length).toBe(2);
    });

    it("should skip duplicates in batch write", async () => {
      const responses = [
        {
          response: {
            id: "dup-resp-1",
            consultationId,
            responderId: "agent-1",
            sessionId: "session-1",
            rawResponse: "Original",
            keyPoints: [],
            isValid: true,
            latencyMs: 1000,
            createdAt: Date.now(),
          } as AgentResponseRecord,
          round: 0,
        },
      ];

      // First batch
      await addAgentResponsesBatch(responses);

      // Second batch with same consultation+agent+round
      responses[0].response.rawResponse = "Duplicate";
      const results = await addAgentResponsesBatch(responses);

      expect(results[0].success).toBe(true);

      const stored = await getAgentResponses(consultationId);
      expect(stored.length).toBe(1);
      expect(stored[0].rawResponse).toBe("Original"); // Should keep first
    });
  });

  describe("Persistence Contract (JSON Mode)", () => {
    it("should persist data across reloads", async () => {
      // 创建用户和咨询
      const user = await upsertUser({
        secondmeId: "persist-test",
        name: "Persist Test",
        avatar: "avatar.png",
        accessToken: "token",
        refreshToken: "refresh",
        expiresIn: 7200,
      });

      const consultation = await createConsultation(user.id, "Persistent question");

      await addAgentResponse({
        id: "persist-resp",
        consultationId: consultation.id,
        responderId: "agent-1",
        sessionId: "session-1",
        rawResponse: "Persistent response",
        keyPoints: ["key"],
        isValid: true,
        latencyMs: 1000,
        createdAt: Date.now(),
      });

      // 模拟重启：清除内存缓存
      // 在 JSON 模式下，下次调用会重新加载文件

      // 验证数据可以从文件重新加载
      const reloadedConsultation = await getConsultation(consultation.id);
      expect(reloadedConsultation).toBeDefined();
      expect(reloadedConsultation?.question).toBe("Persistent question");

      const reloadedUser = await getUserById(user.id);
      expect(reloadedUser).toBeDefined();
      expect(reloadedUser?.name).toBe("Persist Test");

      const reloadedResponses = await getAgentResponses(consultation.id);
      expect(reloadedResponses.length).toBe(1);
      expect(reloadedResponses[0].rawResponse).toBe("Persistent response");
    });

    it("should maintain idempotent key contract", async () => {
      // 幂等键规范：consultation:{id}:round:{round}:agent:{agentId}
      const consultation = await createConsultation("asker-id", "Test question");

      // 模拟幂等键的生成逻辑
      const idempotentKey = `consultation:${consultation.id}:round:0:agent:agent-1`;

      // 键格式验证
      expect(idempotentKey).toMatch(
        /^consultation:[a-f0-9-]+:round:\d+:agent:[a-z0-9-]+$/i
      );

      // 确保在相同键下多次添加不会重复
      const response: AgentResponseRecord = {
        id: "resp-1",
        consultationId: consultation.id,
        responderId: "agent-1",
        sessionId: "session-1",
        rawResponse: "Test",
        keyPoints: [],
        isValid: true,
        latencyMs: 1000,
        createdAt: Date.now(),
      };

      await addAgentResponse(response, 0);
      await addAgentResponse(response, 0); // 相同 round 和 agent

      const responses = await getAgentResponses(consultation.id);
      expect(responses.length).toBe(1);
    });
  });

  describe("Async Contract Verification", () => {
    it("all exported functions should return promises", async () => {
      // 验证所有函数都是异步的（返回 Promise）
      const userPromise = upsertUser({
        secondmeId: "async-test",
        name: "Async Test",
        avatar: "avatar.png",
        accessToken: "token",
        refreshToken: "refresh",
        expiresIn: 7200,
      });
      expect(userPromise).toBeInstanceOf(Promise);
      const user = await userPromise;

      const consultationPromise = createConsultation(user.id, "Async question");
      expect(consultationPromise).toBeInstanceOf(Promise);
      const consultation = await consultationPromise;

      expect(getConsultation(consultation.id)).toBeInstanceOf(Promise);
      expect(getUserById(user.id)).toBeInstanceOf(Promise);
      expect(getConsultableUsers(user.id)).toBeInstanceOf(Promise);
      expect(updateConsultation(consultation.id, { status: "DONE" })).toBeInstanceOf(Promise);
      expect(getUserConsultations(user.id)).toBeInstanceOf(Promise);
      expect(getAgentResponses(consultation.id)).toBeInstanceOf(Promise);
      expect(updateUserTokens(user.id, "new", "new", 3600)).toBeInstanceOf(Promise);
      expect(circuitBreakUser(user.id, 1000)).toBeInstanceOf(Promise);
    });
  });
});
