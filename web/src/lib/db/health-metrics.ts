// Health Metrics CRUD operations with bounded retention

import type { DbAdapter } from "./types";
import {
  KV_KEYS,
  RETENTION,
  MIGRATION_TRIGGERS,
  type HealthMetricType,
  type HealthMetricPoint,
  type WeeklySnapshot,
  type HealthMetricsIndex,
  type StorageLatencyMetrics,
} from "./types";

function formatDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split("T")[0];
}

export function getWeekId(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const d = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7);
  return year + "-W" + weekNum.toString().padStart(2, "0");
}

function getWeekBounds(weekId: string): { start: number; end: number } {
  const parts = weekId.split("-W");
  const year = parseInt(parts[0], 10);
  const weekNum = parseInt(parts[1], 10);
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const dayOffset = (weekNum - 1) * 7;
  const weekStart = new Date(yearStart.getTime() + dayOffset * 86400000);
  const dayOfWeek = weekStart.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  weekStart.setUTCDate(weekStart.getUTCDate() + mondayOffset);
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000 + 86399999);
  return { start: weekStart.getTime(), end: weekEnd.getTime() };
}

export function createHealthMetricsOps(db: DbAdapter) {
  async function trackLatency<T>(
    operation: string,
    keyPattern: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const latencyMs = performance.now() - start;
      const metric: StorageLatencyMetrics = {
        operation,
        latencyMs,
        timestamp: Date.now(),
        keyPattern,
      };
      if (latencyMs > MIGRATION_TRIGGERS.P95_LATENCY_MS) {
        db.set(KV_KEYS.health.latencyMetrics(Date.now()), metric, {
          ex: RETENTION.WEEKLY_TTL_SECONDS,
        }).catch(() => {});
      }
    }
  }

  async function updateMetricsIndex(userId: string, metricType: HealthMetricType): Promise<void> {
    const key = KV_KEYS.health.userMetricsIndex(userId);
    const existing = await db.get<HealthMetricsIndex>(key);
    const now = Date.now();
    const index: HealthMetricsIndex = existing || {
      userId,
      metricTypes: [],
      lastUpdated: now,
      rawRetentionCutoff: now - RETENTION.RAW_DAYS * 24 * 60 * 60 * 1000,
    };
    if (!index.metricTypes.includes(metricType)) {
      index.metricTypes.push(metricType);
    }
    index.lastUpdated = now;
    index.rawRetentionCutoff = now - RETENTION.RAW_DAYS * 24 * 60 * 60 * 1000;
    await db.set(key, index);
  }

  async function getUserMetricTypes(userId: string): Promise<HealthMetricType[]> {
    const key = KV_KEYS.health.userMetricsIndex(userId);
    const index = await db.get<HealthMetricsIndex>(key);
    return index?.metricTypes || [];
  }

  async function addRawMetric(
    userId: string,
    metricType: HealthMetricType,
    point: HealthMetricPoint
  ): Promise<void> {
    await trackLatency("addRawMetric", "health:" + userId + ":raw:" + metricType + ":*", async () => {
      const dateKey = formatDateKey(point.timestamp);
      const key = KV_KEYS.health.rawMetric(userId, metricType, dateKey);
      const existing = await db.get<HealthMetricPoint[]>(key);
      const points = existing || [];
      points.push(point);
      points.sort((a, b) => a.timestamp - b.timestamp);
      await db.set(key, points, { ex: RETENTION.RAW_TTL_SECONDS });
      await updateMetricsIndex(userId, metricType);
    });
  }

  async function addRawMetricsBatch(
    userId: string,
    metricType: HealthMetricType,
    points: HealthMetricPoint[]
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    const byDate = new Map<string, HealthMetricPoint[]>();
    for (const point of points) {
      const dateKey = formatDateKey(point.timestamp);
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, []);
      }
      byDate.get(dateKey)!.push(point);
    }

    await trackLatency("addRawMetricsBatch", "health:" + userId + ":raw:" + metricType + ":*", async () => {
      for (const [dateKey, datePoints] of Array.from(byDate.entries())) {
        try {
          const key = KV_KEYS.health.rawMetric(userId, metricType, dateKey);
          const existing = await db.get<HealthMetricPoint[]>(key);
          const allPoints = [...(existing || []), ...datePoints];
          allPoints.sort((a, b) => a.timestamp - b.timestamp);
          await db.set(key, allPoints, { ex: RETENTION.RAW_TTL_SECONDS });
          success += datePoints.length;
        } catch {
          failed += datePoints.length;
        }
      }
      if (success > 0) {
        await updateMetricsIndex(userId, metricType);
      }
    });

    return { success, failed };
  }

  async function getRawMetrics(
    userId: string,
    metricType: HealthMetricType,
    startTime: number,
    endTime: number
  ): Promise<HealthMetricPoint[]> {
    return trackLatency("getRawMetrics", "health:" + userId + ":raw:" + metricType + ":*", async () => {
      const result: HealthMetricPoint[] = [];
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);
      const current = new Date(startDate);
      while (current <= endDate) {
        const dateKey = formatDateKey(current.getTime());
        const key = KV_KEYS.health.rawMetric(userId, metricType, dateKey);
        const dayPoints = await db.get<HealthMetricPoint[]>(key);
        if (dayPoints) {
          const filtered = dayPoints.filter(
            (p) => p.timestamp >= startTime && p.timestamp <= endTime
          );
          result.push(...filtered);
        }
        current.setUTCDate(current.getUTCDate() + 1);
      }
      return result.sort((a, b) => a.timestamp - b.timestamp);
    });
  }

  async function saveWeeklySnapshot(
    userId: string,
    metricType: HealthMetricType,
    snapshot: WeeklySnapshot
  ): Promise<void> {
    await trackLatency("saveWeeklySnapshot", "health:" + userId + ":weekly:" + metricType + ":*", async () => {
      const key = KV_KEYS.health.weeklySnapshot(userId, metricType, snapshot.weekId);
      await db.set(key, snapshot, { ex: RETENTION.WEEKLY_TTL_SECONDS });
    });
  }

  async function getWeeklySnapshots(
    userId: string,
    metricType: HealthMetricType,
    startWeekId: string,
    endWeekId: string
  ): Promise<WeeklySnapshot[]> {
    return trackLatency("getWeeklySnapshots", "health:" + userId + ":weekly:" + metricType + ":*", async () => {
      const result: WeeklySnapshot[] = [];
      const startBounds = getWeekBounds(startWeekId);
      const endBounds = getWeekBounds(endWeekId);
      let currentTime = startBounds.start;
      while (currentTime <= endBounds.end) {
        const weekId = getWeekId(currentTime);
        const key = KV_KEYS.health.weeklySnapshot(userId, metricType, weekId);
        const snapshot = await db.get<WeeklySnapshot>(key);
        if (snapshot) {
          result.push(snapshot);
        }
        currentTime += 7 * 24 * 60 * 60 * 1000;
      }
      return result.sort((a, b) => a.startDate - b.startDate);
    });
  }

  async function aggregateToWeekly(
    userId: string,
    metricType: HealthMetricType,
    weekId: string
  ): Promise<WeeklySnapshot | null> {
    const bounds = getWeekBounds(weekId);
    const points = await getRawMetrics(userId, metricType, bounds.start, bounds.end);
    if (points.length === 0) return null;

    const values = points.map((p) => p.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    const sourceCounts = new Map<string, number>();
    let totalConfidence = 0;
    for (const point of points) {
      sourceCounts.set(point.source, (sourceCounts.get(point.source) || 0) + 1);
      totalConfidence += point.confidence;
    }
    const primarySource = Array.from(sourceCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
    const avgConfidence = totalConfidence / points.length;

    const snapshot: WeeklySnapshot = {
      weekId,
      startDate: bounds.start,
      endDate: bounds.end,
      metricType,
      avg: Math.round(avg * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      count: points.length,
      unit: points[0].unit,
      source: primarySource,
      confidence: Math.round(avgConfidence * 100) / 100,
      rawDataPoints: points.length,
    };

    await saveWeeklySnapshot(userId, metricType, snapshot);
    return snapshot;
  }

  async function getMetricsForWindow(
    userId: string,
    metricType: HealthMetricType,
    startTime: number,
    endTime: number
  ): Promise<{
    raw: HealthMetricPoint[];
    weekly: WeeklySnapshot[];
    boundaryWeek?: string;
  }> {
    const now = Date.now();
    const rawRetentionCutoff = now - RETENTION.RAW_DAYS * 24 * 60 * 60 * 1000;
    let raw: HealthMetricPoint[] = [];
    let weekly: WeeklySnapshot[] = [];
    let boundaryWeek: string | undefined;

    if (endTime > rawRetentionCutoff) {
      const rawStart = Math.max(startTime, rawRetentionCutoff);
      raw = await getRawMetrics(userId, metricType, rawStart, endTime);
    }

    if (startTime < rawRetentionCutoff) {
      const weeklyStartWeek = getWeekId(startTime);
      const weeklyEndWeek = getWeekId(Math.min(endTime, rawRetentionCutoff));
      weekly = await getWeeklySnapshots(userId, metricType, weeklyStartWeek, weeklyEndWeek);
      if (startTime < rawRetentionCutoff && endTime > rawRetentionCutoff) {
        boundaryWeek = getWeekId(rawRetentionCutoff);
      }
    }

    return { raw, weekly, boundaryWeek };
  }

  async function deleteAllUserMetrics(userId: string): Promise<void> {
    const types = await getUserMetricTypes(userId);
    for (const _type of types) {
      const indexKey = KV_KEYS.health.userMetricsIndex(userId);
      await db.del(indexKey);
    }
  }

  async function checkMigrationTriggers(): Promise<{
    shouldMigrate: boolean;
    reasons: string[];
    metrics: { highLatencyOps: number; totalOps: number };
  }> {
    return { shouldMigrate: false, reasons: [], metrics: { highLatencyOps: 0, totalOps: 0 } };
  }

  return {
    addRawMetric,
    addRawMetricsBatch,
    getRawMetrics,
    saveWeeklySnapshot,
    getWeeklySnapshots,
    aggregateToWeekly,
    getMetricsForWindow,
    updateMetricsIndex,
    getUserMetricTypes,
    deleteAllUserMetrics,
    checkMigrationTriggers,
  };
}

export type HealthMetricsOps = ReturnType<typeof createHealthMetricsOps>;
