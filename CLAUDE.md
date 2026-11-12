# Working on this repo

- **Read first:** [docs/SCOPING.md](docs/SCOPING.md) (source of truth for what we
  build and the phase order, §10), then [docs/PLAN.md](docs/PLAN.md) ("Where we
  are", the engineering log). Update PLAN.md at the end of every phase.
- **Spec first:** before building any feature, write `docs/specs/NNN-name.md` from
  [docs/specs/000-template.md](docs/specs/000-template.md) and **wait for Nisha's
  approval** before writing code. Making existing code run (bug fixes, CI,
  devcontainer) doesn't need a spec.
- **Explain in plain English.** Nisha is new to programming and git.
- **Secrets:** only in GitHub Codespaces secrets, never in files or commits. The repo
  is public. `.env*` stays gitignored. Before every commit, check that no keys are staged.
- **Never show Tamil script in the UI.** Store it only for text-to-speech; show
  Tanglish + English. Default to spoken (colloquial) Tamil.
- **Bug log:** when a bug is found or fixed, update [docs/BUGS.md](docs/BUGS.md)
  (what happened, why, how it was fixed).
- Commit after each working step, then push.
- Commands: `npm run dev` (app on port 3000), `npm test` (no database),
  `npm run test:db` (starts a local Supabase in Docker, runs all tests),
  `npm run typecheck`, `npm run ingest` (rebuild `data/lessons.json`).
