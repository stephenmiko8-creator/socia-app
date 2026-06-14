import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text, platforms } = await req.json();

    if (!text || !platforms || platforms.length === 0) {
      return NextResponse.json({ error: "Missing text or platforms" }, { status: 400 });
    }

    const userId = session.user.id;

    // Save post to database
    const post = await prisma.post.create({
      data: {
        text,
        platforms: platforms.join(","),
        status: "PUBLISHED",
        scheduledAt: new Date(),
        userId
      }
    });

    let results = [];

    // Publish to LinkedIn
    if (platforms.includes("linkedin")) {
      const account = await prisma.account.findFirst({
        where: { userId, provider: "linkedin" }
      });

      if (!account || !account.access_token) {
        return NextResponse.json({ error: "No LinkedIn account linked" }, { status: 400 });
      }

      // LinkedIn OpenID Connect uses the `sub` (providerAccountId) for the person URN
      const personUrn = `urn:li:person:${account.providerAccountId}`;

      const linkedInBody = {
        author: personUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text },
            shareMediaCategory: "NONE"
          }
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
      };

      const liRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${account.access_token}`,
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(linkedInBody)
      });

      const liData = await liRes.json().catch(() => ({})); // Sometimes returns empty on success
      
      if (!liRes.ok) {
        console.error("LinkedIn API Error:", liData);
        results.push({ platform: "linkedin", success: false, error: liData });
      } else {
        results.push({ platform: "linkedin", success: true, data: liData });
      }
    }

    // Publish to Twitter
    if (platforms.includes("twitter")) {
      const account = await prisma.account.findFirst({
        where: { userId, provider: "twitter" }
      });

      if (!account || !account.access_token) {
        return NextResponse.json({ error: "No Twitter account linked" }, { status: 400 });
      }

      // Twitter API v2
      const twitterRes = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${account.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
      });

      const twData = await twitterRes.json().catch(() => ({}));
      
      if (!twitterRes.ok) {
        console.error("Twitter API Error:", twData);
        results.push({ platform: "twitter", success: false, error: twData });
      } else {
        results.push({ platform: "twitter", success: true, data: twData });
      }
    }

    // Publish to TikTok
    if (platforms.includes("tiktok")) {
      const account = await prisma.account.findFirst({
        where: { userId, provider: "tiktok" }
      });

      if (!account || !account.access_token) {
        return NextResponse.json({ error: "No TikTok account linked" }, { status: 400 });
      }

      // Convert the text into slides by splitting double newlines
      const slides = text.split('\n\n').filter(t => t.trim().length > 0);
      const totalSlides = slides.length || 1;
      const baseUrl = process.env.NEXTAUTH_URL || "https://yourdomain.com";

      // Generate the public URLs for our Next.js image generation route
      const photoUrls = slides.map((slideText, index) => {
        return `${baseUrl}/api/og/carousel?text=${encodeURIComponent(slideText.slice(0, 150))}&slide=${index + 1}&total=${totalSlides}&author=${encodeURIComponent(session.user.name || "Alex Studio")}`;
      });

      const tiktokBody = {
        post_info: {
          title: "Auto-generated post",
          description: text.slice(0, 150) // Caption for the post
        },
        source_info: {
          source: "PULL_FROM_URL",
          photo_images: photoUrls
        },
        post_mode: "DIRECT_POST",
        media_type: "PHOTO"
      };

      const tiktokRes = await fetch("https://open.tiktokapis.com/v2/post/publish/content/init/", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${account.access_token}`,
          "Content-Type": "application/json; charset=UTF-8"
        },
        body: JSON.stringify(tiktokBody)
      });

      const tiktokData = await tiktokRes.json().catch(() => ({}));
      
      if (!tiktokRes.ok) {
        console.error("TikTok API Error:", tiktokData);
        results.push({ platform: "tiktok", success: false, error: tiktokData });
      } else {
        results.push({ platform: "tiktok", success: true, data: tiktokData });
      }
    }

    // Publish to YouTube (Stub for future video generation integration)
    if (platforms.includes("youtube")) {
      results.push({ 
        platform: "youtube", 
        success: false, 
        error: "YouTube Data API requires a video file. AI video generation must be integrated first." 
      });
    }

    return NextResponse.json({ success: true, post, results });
  } catch (error) {
    console.error("Publishing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
