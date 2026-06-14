import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const post = await prisma.post.findUnique({
      where: { id }
    });

    if (!post || post.userId !== session.user.id) {
      return NextResponse.json({ error: "Post not found or unauthorized" }, { status: 404 });
    }

    await prisma.post.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    console.error("Delete Post Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const { text } = await req.json();

    const post = await prisma.post.findUnique({
      where: { id }
    });

    if (!post || post.userId !== session.user.id) {
      return NextResponse.json({ error: "Post not found or unauthorized" }, { status: 404 });
    }

    const updatedPost = await prisma.post.update({
      where: { id },
      data: { text }
    });

    return NextResponse.json({ success: true, post: updatedPost });
  } catch (error) {
    console.error("Update Post Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
