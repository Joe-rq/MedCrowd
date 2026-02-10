import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getConsultation, getAgentResponses } from "@/lib/db";

export async function GET(
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

  // Only the asker can view full details
  const isOwner = consultation.askerId === session.userId;

  const responses = await getAgentResponses(id);

  return NextResponse.json({
    consultation: {
      ...consultation,
      question: isOwner ? consultation.question : undefined,
    },
    responses: responses.map((r) => ({
      id: r.id,
      rawResponse: r.isValid ? r.rawResponse : undefined,
      keyPoints: r.keyPoints,
      isValid: r.isValid,
      invalidReason: r.invalidReason,
      latencyMs: r.latencyMs,
    })),
  });
}
