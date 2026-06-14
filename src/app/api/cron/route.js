import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized cron execution" }, { status: 401 });
    }

    // 1. Find all scheduled posts whose scheduled time is in the past (time to publish!)
    const postsToPublish = await prisma.post.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: {
          lte: new Date()
        }
      },
      include: {
        user: {
          include: {
            accounts: true
          }
        }
      }
    });

    if (postsToPublish.length === 0) {
      return NextResponse.json({ success: true, message: "No posts are due for publishing right now." });
    }

    const results = [];

    // 2. Loop through and publish each one silently in the background
    for (const post of postsToPublish) {
      const platforms = post.platforms.split(",");
      
      if (platforms.includes("linkedin")) {
        const linkedInAccount = post.user.accounts.find(acc => acc.provider === "linkedin");
        
        if (linkedInAccount && linkedInAccount.access_token) {
          const personUrn = `urn:li:person:${linkedInAccount.providerAccountId}`;

          const linkedInBody = {
            author: personUrn,
            lifecycleState: "PUBLISHED",
            specificContent: {
              "com.linkedin.ugc.ShareContent": {
                shareCommentary: { text: post.text },
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
              "Authorization": `Bearer ${linkedInAccount.access_token}`,
              "X-Restli-Protocol-Version": "2.0.0",
              "Content-Type": "application/json"
            },
            body: JSON.stringify(linkedInBody)
          });

          if (liRes.ok) {
            // 3. Mark as published in our database so it doesn't get posted twice
            await prisma.post.update({
              where: { id: post.id },
              data: { status: "PUBLISHED" }
            });
            results.push({ postId: post.id, platform: "linkedin", success: true });
          } else {
            const errorData = await liRes.json().catch(() => ({}));
            results.push({ postId: post.id, platform: "linkedin", success: false, error: errorData });
          }
        } else {
          results.push({ postId: post.id, platform: "linkedin", success: false, error: "No LinkedIn token found" });
        }
      }

      if (platforms.includes("twitter")) {
        const twitterAccount = post.user.accounts.find(acc => acc.provider === "twitter");
        
        if (twitterAccount && twitterAccount.access_token) {
          const twRes = await fetch("https://api.twitter.com/2/tweets", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${twitterAccount.access_token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ text: post.text })
          });

          if (twRes.ok) {
            await prisma.post.update({
              where: { id: post.id },
              data: { status: "PUBLISHED" }
            });
            results.push({ postId: post.id, platform: "twitter", success: true });
          } else {
            const errorData = await twRes.json().catch(() => ({}));
            results.push({ postId: post.id, platform: "twitter", success: false, error: errorData });
          }
        } else {
          results.push({ postId: post.id, platform: "twitter", success: false, error: "No Twitter token found" });
        }
      }

      if (platforms.includes("tiktok")) {
        const tiktokAccount = post.user.accounts.find(acc => acc.provider === "tiktok");
        
        if (tiktokAccount && tiktokAccount.access_token) {
          const slides = post.text.split('\n\n').filter(t => t.trim().length > 0);
          const totalSlides = slides.length || 1;
          const baseUrl = process.env.NEXTAUTH_URL || "https://yourdomain.com";

          const photoUrls = slides.map((slideText, index) => {
            return `${baseUrl}/api/og/carousel?text=${encodeURIComponent(slideText.slice(0, 150))}&slide=${index + 1}&total=${totalSlides}&author=${encodeURIComponent(post.user.name || "Alex Studio")}`;
          });

          const tiktokBody = {
            post_info: {
              title: "Auto-generated post",
              description: post.text.slice(0, 150)
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
              "Authorization": `Bearer ${tiktokAccount.access_token}`,
              "Content-Type": "application/json; charset=UTF-8"
            },
            body: JSON.stringify(tiktokBody)
          });

          if (tiktokRes.ok) {
            await prisma.post.update({
              where: { id: post.id },
              data: { status: "PUBLISHED" }
            });
            results.push({ postId: post.id, platform: "tiktok", success: true });
          } else {
            const errorData = await tiktokRes.json().catch(() => ({}));
            results.push({ postId: post.id, platform: "tiktok", success: false, error: errorData });
          }
        } else {
          results.push({ postId: post.id, platform: "tiktok", success: false, error: "No TikTok token found" });
        }
      }
    }

    return NextResponse.json({ success: true, results, message: `Successfully attempted to publish ${postsToPublish.length} posts.` });

  } catch (error) {
    console.error("Cron Publish Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
