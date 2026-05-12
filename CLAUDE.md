# Sidenote

A locally-run web app for managing notes on research papers.

## First-time setup (agents read this)

At the start of every session, check whether `data/research.db` exists in the repo root.

- **If it does not exist:** run `npm run setup` immediately without asking the user. This is always safe — it installs dependencies, creates the database, creates `data/pdfs/`, and symlinks the agent skills into `~/.claude/skills/`. It will not overwrite existing data.
- **If it exists:** no action needed.

After setup, the dev server can be started with `npm run dev`. The app runs at `http://localhost:3000`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `DarioVajda/sidenote`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo — one `CONTEXT.md` + `docs/adr/` at the root. See `docs/agents/domain.md`.
