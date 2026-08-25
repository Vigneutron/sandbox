import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getUserFromRequest } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  // trim: whitespace/newlines sneak in when pasting env vars on mobile
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  const priceId = process.env.STRIPE_PRICE_ID?.trim();
  if (!stripeKey || !priceId) {
    return NextResponse.json(
      { error: "Billing isn't configured on this deployment yet." },
      { status: 503 }
    );
  }

  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  const stripe = new Stripe(stripeKey);
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: auth.user.email ?? undefined,
      client_reference_id: auth.user.id,
      metadata: { user_id: auth.user.id },
      // carried onto the subscription so cancellation webhooks can find the user
      subscription_data: { metadata: { user_id: auth.user.id } },
      success_url: `${origin}/upgrade?success=1`,
      cancel_url: `${origin}/upgrade?canceled=1`,
      allow_promotion_codes: true,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Stripe error";
    console.error("checkout:", message);
    return NextResponse.json({ error: `Stripe error: ${message}` }, { status: 500 });
  }
}
