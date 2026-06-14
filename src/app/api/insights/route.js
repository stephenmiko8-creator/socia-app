import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch published posts
    let posts = await prisma.post.findMany({
      where: { userId: session.user.id, status: "PUBLISHED" },
      orderBy: { scheduledAt: 'desc' },
      take: 10
    });

    // Fallback for UI demonstration if they haven't published anything yet
    if (posts.length === 0) {
      posts = await prisma.post.findMany({
        where: { userId: session.user.id },
        orderBy: { scheduledAt: 'desc' },
        take: 5
      });
    }

    // Generate mock engagement data based on text length for realistic variation
    let totalImpressions = 0;
    let totalEngagements = 0;

    const insightsData = posts.map(post => {
      const baseMetrics = post.text.length * 2;
      const views = Math.floor(baseMetrics * 1.5 + Math.random() * 500);
      const likes = Math.floor(views * 0.08 + Math.random() * 20);
      const comments = Math.floor(likes * 0.15 + Math.random() * 5);
      
      totalImpressions += views;
      totalEngagements += (likes + comments);

      return {
        id: post.id,
        text: post.text.substring(0, 80) + "...",
        date: post.scheduledAt,
        views,
        likes,
        comments,
        engagementRate: ((likes + comments) / views * 100).toFixed(1) + "%"
      };
    });

    const averageEngagement = totalImpressions > 0 ? ((totalEngagements / totalImpressions) * 100).toFixed(1) : 0;

    return NextResponse.json({ 
      success: true, 
      overview: {
        totalImpressions: totalImpressions.toLocaleString(),
        totalEngagements: totalEngagements.toLocaleString(),
        averageEngagement: averageEngagement + "%"
      },
      topPosts: insightsData.sort((a,b) => b.views - a.views)
    });

  } catch (error) {
    console.error("Insights Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
