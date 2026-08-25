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

### Roadmap

1. Stripe subscription checkout for Pro (move the `pro` flag server-side)
2. Progress visualizations (habit history heatmap)
3. Email/push reminders (Pro)
4. Landing page polish

## Development

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # production build
npm run lint
```

Stack: Next.js (App Router) · TypeScript · Tailwind CSS
