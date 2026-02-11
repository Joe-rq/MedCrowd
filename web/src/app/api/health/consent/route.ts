import type {
  ConsentStatusResponse,
  GrantConsentRequest,
  RevokeConsentRequest,
} from "@/lib/consent/types";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getConsentRecord, grantConsent, revokeConsent } from "@/lib/db";

const CURRENT_CONSENT_VERSION = "v1.0";

const DEFAULT_SCOPE = {
  metrics: ["weight", "bmi", "sleep", "heartRate", "hrv"],
  sources: ["apple_health", "google_fit", "withings", "manual_entry", "file_import"],
  purpose: "health_consultation" as const,
};

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const record = await getConsentRecord(session.userId);

  const response: ConsentStatusResponse = {
    hasConsent: record?.status === "GRANTED" && (!record.expiresAt || record.expiresAt > Date.now()),
    status: record?.status || "NONE",
    grantedAt: record?.grantedAt,
    expiresAt: record?.expiresAt,
    scope: record?.scope,
    version: record?.version,
  };

  return NextResponse.json(response);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body: GrantConsentRequest = await request.json();

    if (!body.acknowledgedTerms) {
      return NextResponse.json(
        { error: "必须确认同意条款" },
        { status: 400 }
      );
    }

    const headers = request.headers;
    const metadata = {
      ipAddress: headers.get("x-forwarded-for") || undefined,
      userAgent: headers.get("user-agent") || undefined,
    };

    const scope = body.scope || DEFAULT_SCOPE;
    const version = body.version || CURRENT_CONSENT_VERSION;

    const record = await grantConsent(session.userId, scope, version, metadata);

    const response: ConsentStatusResponse = {
      hasConsent: true,
      status: record.status,
      grantedAt: record.grantedAt,
      expiresAt: record.expiresAt,
      scope: record.scope,
      version: record.version,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Grant consent error:", error);
    return NextResponse.json(
      { error: "授权失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body: RevokeConsentRequest = await request.json().catch(() => ({}));

    const headers = request.headers;
    const metadata = {
      reason: body.reason,
      deleteData: body.deleteData ?? false,
      ipAddress: headers.get("x-forwarded-for") || undefined,
      userAgent: headers.get("user-agent") || undefined,
    };

    const record = await revokeConsent(session.userId, metadata);

    if (!record) {
      return NextResponse.json(
        { error: "未找到授权记录" },
        { status: 404 }
      );
    }

    const response: ConsentStatusResponse = {
      hasConsent: false,
      status: record.status,
      grantedAt: record.grantedAt,
      revokedAt: record.revokedAt,
      scope: record.scope,
      version: record.version,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Revoke consent error:", error);
    return NextResponse.json(
      { error: "撤销授权失败，请稍后重试" },
      { status: 500 }
    );
  }
}
