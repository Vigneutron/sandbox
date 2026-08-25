import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getUserFromRequest } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json(
      { error: "Billing isn't configured on this deployment yet." },
      { status: 503 }
    );
  }

  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  const { data } = await auth.asUser
    .from("profiles")
    .select("stripe_customer_id")
    .maybeSingle();
  if (!data?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No subscription found for this account." },
      { status: 404 }
    );
  }

  const stripe = new Stripe(stripeKey);
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${origin}/upgrade`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Stripe error";
    console.error("portal:", message);
    return NextResponse.json({ error: `Stripe error: ${message}` }, { status: 500 });
  }
}
