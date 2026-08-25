# Goal Goal Gadget

Goal management for ambitious people. Built on habit-science principles:
identity-based goals, tiny two-minute habits, implementation intentions
("After X, I will Y"), and streaks — get 1% better every day.

## Business model

- **Free**: up to 2 goals, ad-supported
- **Pro ($3/mo)**: unlimited goals & habits, ad-free, future premium features

## Status

MVP. Data is stored in the browser (localStorage) — no accounts or backend
yet. The upgrade flow is a demo stub pending Stripe integration.

### Roadmap

1. Accounts + database (Supabase) so data syncs across devices
2. Stripe subscription checkout for Pro
3. Progress visualizations (habit history heatmap)
4. Email/push reminders (Pro)
5. Landing page + deploy (Vercel)

## Development

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # production build
npm run lint
```

Stack: Next.js (App Router) · TypeScript · Tailwind CSS
