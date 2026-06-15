import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const errLog = searchParams.get("error");
  
  try {
    if (errLog) {
      // Save the error as a dummy user!
      await prisma.user.create({
        data: {
          name: `ERROR: ${errLog.substring(0, 100)}`,
          email: `err_${Date.now()}@test.com`,
          image: errLog.substring(0, 1000) // save the rest in image field!
        }
      });
      return NextResponse.json({ success: true, logged: true });
    }

    // Attempt a simple database connection query
    const count = await prisma.user.count();
    const recentUsers = await prisma.user.findMany({
      orderBy: { id: 'desc' },
      take: 5
    });
    
    // Attempt to simulate the account creation
    const dummyId = `test_${Date.now()}`;
    const user = await prisma.user.create({
      data: {
        name: "Test User",
        email: `${dummyId}@example.com`,
      }
    });

    const account = await prisma.account.create({
      data: {
        userId: user.id,
        type: "oauth",
        provider: "tiktok",
        providerAccountId: dummyId,
        access_token: "act.test_token_from_tiktok_that_is_very_long_like_this",
        refresh_token: "rft.test_refresh_token_that_is_even_longer_than_the_access_token",
        token_type: "Bearer",
        scope: "user.info.basic"
      }
    });

    // Cleanup
    await prisma.user.delete({ where: { id: user.id } });

    return NextResponse.json({ 
      success: true, 
      message: "Database connection and write operations work perfectly!",
      totalUsers: count,
      recentUsers: recentUsers
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error.message, 
      code: error.code, 
      meta: error.meta,
      name: error.name,
      stack: error.stack
    }, { status: 500 });
  }
}
