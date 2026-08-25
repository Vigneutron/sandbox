# Goal Goal Gadget

Goal management for ambitious people. Built on habit-science principles:
identity-based goals, tiny two-minute habits, implementation intentions
("After X, I will Y"), and streaks — get 1% better every day.

## Business model

- **Free**: up to 2 goals, ad-supported
- **Pro ($3/mo)**: unlimited goals & habits, ad-free, future premium features

## Status

MVP with optional accounts. Signed-out visitors get localStorage-only mode;
signing in syncs goals, habits, and streaks to Supabase (existing local data
migrates to the account on first sign-in). The upgrade flow is a demo stub
pending Stripe integration.

### Supabase setup

1. Create a free project at supabase.com
2. Run `supabase/schema.sql` in the SQL Editor
3. Authentication → Sign In / Providers → Email: disable "Confirm email"
   (or keep it on and users confirm via email before signing in)
4. Copy the Project URL and anon key from Project Settings → API into the
   env vars listed in `.env.example` (locally in `.env.local`; in production
   in Vercel → Settings → Environment Variables, then redeploy)

Without those env vars the app runs in local-only mode and the Account page
says accounts are coming soon.

### Stripe setup

1. Run `supabase/stripe-migration.sql` in the Supabase SQL Editor
2. In the Stripe dashboard, create a product "Goal Goal Gadget Pro" with a
   recurring $3/month price; copy the price ID
3. Add a webhook endpoint pointing at
   `https://<your-domain>/api/stripe-webhook` listening for
   `checkout.session.completed` and `customer.subscription.deleted`;
   copy its signing secret
4. Set the four server env vars listed in `.env.example` (plus the
   Supabase service-role key) in Vercel and redeploy

Pro status is granted and revoked only by the Stripe webhook using the
service-role key; browsers can read but never write their own `pro` flag.
Use Stripe test mode (card 4242 4242 4242 4242) end-to-end before switching
to live keys.

### Roadmap

1. Progress visualizations (habit history heatmap)
2. Email/push reminders (Pro)
3. Landing page polish

## Development

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # production build
npm run lint
```

Stack: Next.js (App Router) · TypeScript · Tailwind CSS
