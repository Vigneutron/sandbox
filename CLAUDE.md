# Sandbox conventions

This repository is a universal sandbox: every app built here lives in its own folder under `apps/`.

## Rules for adding or changing apps

- Put each app in `apps/<app-name>/` using a short, kebab-case name.
- Every app must be self-contained: its own `README.md` (what it is, how to run it), its own dependencies (e.g. its own `package.json` or `requirements.txt`). Never share code or config between apps.
- After adding, renaming, or removing an app, update the Apps table in the root `README.md` — it is the index of everything in the sandbox.
- Keep the repo root clean: only the root `README.md`, this file, and the `apps/` directory belong at the top level.
- Don't add root-level build tooling, lockfiles, or CI that couples apps together.
