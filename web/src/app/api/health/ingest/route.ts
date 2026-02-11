// Health metrics ingestion API endpoint
// Supports Tier A/B/C fallback strategy

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  ingestWithFallback,
  ingestBatch,
  isDuplicateIngestion,
  type IngestionApiResponse,
} from "@/lib/health-connectors";
import {
  addHealthMetric,
  addHealthMetricsBatch,
  getHealthMetrics,
  checkConsent,
  logSyncBlocked,
} from "@/lib/db";
import type { HealthMetricType, HealthMetricPoint } from "@/lib/db/types";

const VALID_METRIC_TYPES: HealthMetricType[] = ["weight", "bmi", "sleep", "heartRate", "hrv"];

const VALID_SOURCES = [
  "apple_health",
  "google_fit",
  "withings",
  "manual_entry",
  "file_import",
];

// Single metric ingestion
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "未登录" },
      { status: 401 }
    );
  }

  const consentCheck = await checkConsent(session.userId);
  if (!consentCheck.allowed) {
    await logSyncBlocked(session.userId, consentCheck.reason || "Consent not granted");
    return NextResponse.json(
      {
        success: false,
        error: "健康数据同步需要您的授权",
        code: "CONSENT_REQUIRED",
        details: { reason: consentCheck.reason },
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { metricType, data, source, options } = body;

    // Validate required fields
    if (!metricType || !data || !source) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: metricType, data, source",
        },
        { status: 400 }
      );
    }

    // Validate metric type
    if (!VALID_METRIC_TYPES.includes(metricType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid metric type. Must be one of: ${VALID_METRIC_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate source
    if (!VALID_SOURCES.includes(source)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid source. Must be one of: ${VALID_SOURCES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Check for duplicates if timestamp provided
    const skipDedup = options?.skipDedup === true;
    if (!skipDedup && data.timestamp) {
      const existing = await getHealthMetrics(
        session.userId,
        metricType,
        data.timestamp - 300000,
        data.timestamp + 300000
      );

      const potentialDup: HealthMetricPoint = {
        timestamp: data.timestamp,
        value: data.value,
        unit: data.unit || "",
        source,
        confidence: 1,
      };

      if (isDuplicateIngestion(potentialDup, existing)) {
        const response: IngestionApiResponse = {
          success: false,
          message: "Duplicate ingestion rejected",
          error: "Duplicate ingestion detected within 5-minute window",
        };
        return NextResponse.json(response, { status: 409 });
      }
    }

    // Run ingestion with fallback
    const result = await ingestWithFallback({
      userId: session.userId,
      metricType,
      data,
      source,
      options: {
        skipDedup,
        preferredTier: options?.preferredTier,
        timeoutMs: options?.timeoutMs || 30000,
      },
    });

    // Store ingested points
    let stored = 0;
    if (result.success && result.points.length > 0) {
      for (const point of result.points) {
        await addHealthMetric(session.userId, metricType, point);
        stored++;
      }
    }

    // Build response
    if (!result.success || stored === 0) {
      const response: IngestionApiResponse = {
        success: false,
        message: "Ingestion failed",
        error: result.rejected[0]?.reason || "Ingestion failed",
      };
      return NextResponse.json(response, { status: 422 });
    }

    const response: IngestionApiResponse = {
      success: true,
      message: `Successfully ingested ${stored} metric points`,
      data: {
        processed: stored,
        rejected: result.rejected.length,
        deduplicated: result.metadata.deduplicatedCount,
        connectorUsed: result.metadata.connectorId,
        tier: inferTierFromConnector(result.metadata.connectorId),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Health ingestion error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Batch ingestion endpoint
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "未登录" },
      { status: 401 }
    );
  }

  const consentCheck = await checkConsent(session.userId);
  if (!consentCheck.allowed) {
    await logSyncBlocked(session.userId, consentCheck.reason || "Consent not granted");
    return NextResponse.json(
      {
        success: false,
        error: "健康数据同步需要您的授权",
        code: "CONSENT_REQUIRED",
        details: { reason: consentCheck.reason },
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { items, options } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Items array required" },
        { status: 400 }
      );
    }

    // Validate all items
    for (const item of items) {
      if (!item.metricType || !item.data || !item.source) {
        return NextResponse.json(
          { success: false, error: "Each item must have metricType, data, source" },
          { status: 400 }
        );
      }
      if (!VALID_METRIC_TYPES.includes(item.metricType)) {
        return NextResponse.json(
          { success: false, error: `Invalid metric type: ${item.metricType}` },
          { status: 400 }
        );
      }
    }

    // Process batch
    const batchResult = await ingestBatch(
      session.userId,
      items.map((i) => ({
        metricType: i.metricType,
        data: i.data,
        source: i.source,
      })),
      options
    );

    // Store all successful points
    let totalStored = 0;
    for (let i = 0; i < batchResult.results.length; i++) {
      const result = batchResult.results[i];
      const metricType = items[i].metricType;

      if (result.success && result.points.length > 0) {
        const addResult = await addHealthMetricsBatch(
          session.userId,
          metricType,
          result.points
        );
        totalStored += addResult.success;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Batch processed: ${totalStored} stored, ${batchResult.failed} failed`,
      data: {
        processed: totalStored,
        failed: batchResult.failed,
        deduplicated: batchResult.deduplicated,
      },
    });
  } catch (error) {
    console.error("Health batch ingestion error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Helper to infer tier from connector ID
function inferTierFromConnector(connectorId: string): import("@/lib/health-connectors").ConnectorTier {
  if (["apple_health"].includes(connectorId)) return "A";
  if (["google_fit", "withings"].includes(connectorId)) return "B";
  return "C";
}
