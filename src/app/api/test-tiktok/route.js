import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const error_description = searchParams.get("error_description");

  if (error) {
    return NextResponse.json({ step: "authorization", error, error_description });
  }

  if (!code) {
    return NextResponse.json({ error: "No code provided" });
  }

  const redirect_uri = (process.env.NEXTAUTH_URL ? process.env.NEXTAUTH_URL.replace(/\/$/, "") : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")) + "/api/test-tiktok";

  try {
    // 1. Fetch Token
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY || "",
        client_secret: process.env.TIKTOK_CLIENT_SECRET || "",
        code,
        grant_type: "authorization_code",
        redirect_uri,
      }),
    });
    const tokens = await tokenRes.json();

    if (!tokens.access_token) {
      return NextResponse.json({ step: "token", error: "Missing access_token", details: tokens });
    }

    // 2. Fetch User Info
    const userRes = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await userRes.json();

    return NextResponse.json({ step: "success", tokens, profile });
  } catch (err) {
    return NextResponse.json({ step: "catch", error: err.message, stack: err.stack });
  }
}
