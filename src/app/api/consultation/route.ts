import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { checkSafety } from "@/lib/safety";
import { runConsultation } from "@/lib/engine";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await request.json();
  const question = body.question?.trim();

  if (!question || question.length < 5) {
    return NextResponse.json(
      { error: "请输入至少 5 个字的问题" },
      { status: 400 }
    );
  }

  if (question.length > 500) {
    return NextResponse.json(
      { error: "问题不能超过 500 字" },
      { status: 400 }
    );
  }

  // Safety check
  const safety = checkSafety(question);
  if (!safety.safe) {
    return NextResponse.json({
      blocked: true,
      type: safety.type,
      message: safety.message,
    });
  }

  // Run consultation
  try {
    const result = await runConsultation(session.userId, question);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Consultation error:", err);
    return NextResponse.json(
      { error: "咨询过程中出现错误，请稍后重试" },
      { status: 500 }
    );
  }
}
