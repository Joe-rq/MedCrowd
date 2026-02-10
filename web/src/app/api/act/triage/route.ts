import { NextRequest, NextResponse } from "next/server";
import { triageHealthQuestion } from "@/lib/act";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body?.message;

    if (!message || typeof message !== "string" || message.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: "message 字段必填且不少于 2 个字符" },
        { status: 400 }
      );
    }

    const result = await triageHealthQuestion(message.trim());

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[Triage Route] Error:", err);
    return NextResponse.json(
      { success: false, error: "分诊服务暂不可用" },
      { status: 500 }
    );
  }
}
