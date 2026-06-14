import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "dummy");

export async function POST(req) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event;

  try {
    // In production, you would use process.env.STRIPE_WEBHOOK_SECRET here
    // But for local testing without the Stripe CLI, we can just parse the event directly
    event = JSON.parse(body);
  } catch (error) {
    return NextResponse.json({ error: `Webhook Error: ${error.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.client_reference_id;
    const customerId = session.customer;

    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          tier: "PRO",
          stripeCustomerId: customerId,
        },
      });
      console.log(`User ${userId} upgraded to PRO!`);
    }
  }

  return NextResponse.json({ received: true });
}
