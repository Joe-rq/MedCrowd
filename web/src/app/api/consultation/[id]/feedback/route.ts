import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getConsultation, submitFeedback, getFeedback } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  const consultation = await getConsultation(id);

  if (!consultation) {
    return NextResponse.json({ error: "咨询不存在" }, { status: 404 });
  }

  if (consultation.askerId !== session.userId) {
    return NextResponse.json({ error: "无权操作" }, { status: 403 });
  }

  const body = await request.json();
  const { vote, comment } = body;

  if (vote !== "helpful" && vote !== "not_helpful") {
    return NextResponse.json({ error: "无效的投票类型" }, { status: 400 });
  }

  const record = await submitFeedback({
    consultationId: id,
    userId: session.userId,
    vote,
    comment: typeof comment === "string" ? comment.slice(0, 500) : undefined,
  });

  return NextResponse.json(record);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  const record = await getFeedback(id, session.userId);

  return NextResponse.json(record);
}
