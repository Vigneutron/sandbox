# 🧪 Sandbox

A universal sandbox for all the apps I build with Claude. Each app lives in its own folder under [`apps/`](apps/), self-contained and independent — one repo, many experiments.

## Apps

| App | Description | Status |
|-----|-------------|--------|
| _none yet_ | New apps land here as they're built | — |

## How it works

- **One folder per app.** Every app is self-contained in `apps/<app-name>/` with its own README, dependencies, and run instructions.
- **No shared state.** Apps don't depend on each other, so any one can be tried, changed, or deleted without breaking the rest.
- **The index above is the map.** Every new app gets a row in the Apps table so visitors can see everything at a glance.

## Adding a new app

1. Create `apps/<app-name>/` with the app's code.
2. Give it a `README.md` saying what it is and how to run it.
3. Add a row to the Apps table above.

Conventions for Claude-assisted sessions live in [`CLAUDE.md`](CLAUDE.md).
