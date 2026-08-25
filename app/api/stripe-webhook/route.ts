import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

/**
 * Stripe is the source of truth for Pro status: this webhook is the only
 * code path that grants or revokes it, using the service-role key (RLS
 * denies profile writes to everyone else).
 */
export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!stripeKey || !webhookSecret || !url || !serviceKey) {
    return new NextResponse("Billing not configured", { status: 503 });
  }

  const stripe = new Stripe(stripeKey);
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature ?? "", webhookSecret);
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const admin = createClient(url, serviceKey);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id ?? session.client_reference_id;
    if (userId) {
      const { error } = await admin.from("profiles").upsert({
        user_id: userId,
        pro: true,
        stripe_customer_id:
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null,
      });
      if (error) {
        console.error("webhook grant pro:", error.message);
        return new NextResponse("Database error", { status: 500 });
      }
    }
  } else if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.user_id;
    if (userId) {
      const { error } = await admin
        .from("profiles")
        .update({ pro: false })
        .eq("user_id", userId);
      if (error) {
        console.error("webhook revoke pro:", error.message);
        return new NextResponse("Database error", { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
