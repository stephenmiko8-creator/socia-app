import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const posts = await prisma.post.findMany({
      where: {
        userId: session.user.id,
        status: "SCHEDULED"
      },
      orderBy: {
        scheduledAt: 'asc'
      }
    });

    return NextResponse.json({ success: true, posts });
  } catch (error) {
    console.error("Fetch Posts Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
