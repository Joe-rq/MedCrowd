import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, getUserInfo } from "@/lib/secondme";
import { upsertUser } from "@/lib/db";
import { setSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    const desc = searchParams.get("error_description") || "授权失败";
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(desc)}`, request.url)
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get user info
    const userInfo = await getUserInfo(tokens.accessToken);

    // Store user in DB
    const user = upsertUser({
      secondmeId: userInfo.userId,
      name: userInfo.name || "匿名用户",
      avatar: userInfo.avatar || "",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });

    // Set session cookie
    await setSession({
      userId: user.id,
      secondmeId: user.secondmeId,
      name: user.name,
      avatar: user.avatar,
    });

    return NextResponse.redirect(new URL("/ask", request.url));
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent("登录失败，请重试")}`, request.url)
    );
  }
}
