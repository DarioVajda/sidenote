# Sidenote

> A local-first app for reading, annotating, and analysing research papers — with a built-in Claude Code agent that reads papers for you.

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-local--first-003B57?style=flat-square&logo=sqlite)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## What it is

Research Notes is a locally-run web app for managing a personal library of research papers. No cloud, no accounts, no subscriptions — everything lives on your machine.

The core workflow: import a paper by URL, read it in the built-in PDF viewer, and write notes in Markdown alongside it. Notes can contain **PDF references** — links that jump to and highlight specific regions of the PDF when clicked, so you can anchor your writing to exact figures, tables, and equations.

A companion **Claude Code agent** (`/do-research`) can do the reading for you: it imports a paper, reads it in multiple passes with full visual analysis of figures and diagrams, and writes structured notes with PDF references directly into your library.

---

## Features

| | |
|---|---|
| 📥 **Smart import** | Paste a URL from arXiv, ACL Anthology, OpenReview, PMLR, CVF, or NeurIPS — metadata and PDF are extracted automatically |
| 📁 **Folder library** | Organise papers into a recursive folder tree; drag-and-drop to reorganise |
| 📄 **Split-screen reader** | Resizable PDF viewer and Markdown notes editor side by side |
| 🔗 **PDF references** | Draw a rectangle on any PDF region and embed a link to it directly in your notes |
| 🤖 **AI agent** | `/do-research` reads the paper, analyses figures, and writes structured notes with PDF references |
| 📝 **BibTeX export** | One click to copy a formatted BibTeX citation from any paper |
| 🎓 **Scholar links** | Every author name links directly to their Google Scholar profile search |
| 🗑️ **Trash + restore** | Soft-delete with 30-day auto-purge and per-paper restore |

---

## Quick start

**Requirements:** Node.js 18+, npm

```bash
git clone https://github.com/DarioVajda/sidenote
cd sidenote
```

Then pick one of two setup paths:

---

### Option A — Let Claude Code do it

If you have [Claude Code](https://claude.ai/code) installed, open it in the repo directory and it will set everything up automatically:

```bash
claude
```

Claude reads `CLAUDE.md` at the start of every session and runs `npm run setup` automatically on a fresh clone. Once setup is done, type into the Claude Code prompt:

```
> Initialize and start the dev server.
```

> **Restart required for agent skills:** `npm run setup` installs the `/do-research` and `/before-research` skills into `~/.claude/skills/`. If Claude Code was already open when setup ran, restart it so the new skills are picked up.

---

### Option B — Manual setup

```bash
npm run setup
npm run dev
```

`npm run setup` handles everything:

```
→ Installing npm dependencies...
→ Creating data directories...
→ Setting up database...
→ Installing Claude Code agent skills...
  ✓ Linked do-research
  ✓ Linked before-research
→ Checking system dependencies...
  ✓ pdftoppm
  ✓ Pillow

✓ Setup complete. Run 'npm run dev' to start the app.
```

Open [http://localhost:3000](http://localhost:3000).

---

## Importing papers

Click **+ Add paper** and paste a URL from any supported source:

| Source | Example URL |
|---|---|
| arXiv | `https://arxiv.org/abs/1706.03762` |
| ACL Anthology | `https://aclanthology.org/2023.acl-long.1` |
| OpenReview | `https://openreview.net/forum?id=...` |
| PMLR | `https://proceedings.mlr.press/v202/...` |
| CVF | `https://openaccess.thecvf.com/...` |
| NeurIPS | `https://proceedings.neurips.cc/...` |

For anything else, use **Manual import** to upload a PDF and fill in the metadata yourself.

Import is **idempotent** — importing the same URL twice returns the existing paper rather than creating a duplicate.

---

## PDF references

In the notes editor, you can anchor any piece of text to a specific region of the PDF:

1. **Select text** in the editor, then click the link-to-PDF button in the toolbar  
   — or —  
   **Type** `[your text](ref:` anywhere in the editor

2. A crosshair cursor appears over the PDF. Draw a rectangle around the region you want to reference.

3. The link is inserted. In **Preview mode**, clicking it scrolls the PDF to that region and highlights it with a fading blue box.

References are stored inline in the Markdown as `[label](ref:page=2,x1=0.12,y1=0.34,x2=0.56,y2=0.78)` — no separate database table.

---

## Agent skills

Two [Claude Code](https://claude.ai/code) skills ship with this repo and are installed automatically by `npm run setup` into `~/.claude/skills/`. Once installed, they are available globally — you can use them from **any directory** in any Claude Code session, not just inside the Sidenote repo.

> **Skills not showing up?** If Claude Code was already open when you ran `npm run setup`, restart it. Skills are discovered at startup.

### Typical workflow

The skills talk to the Sidenote app over HTTP, so it must be running. Start it once and leave it in the background:

```bash
# Terminal 1 — keep this running
cd path/to/sidenote
npm run dev
```

Then open Claude Code in your own research project and use the skills there:

```bash
# Terminal 2 — your research project
cd your-research-project
claude
```

### `/before-research`

Run this once per research project to create a `RESEARCH_CONTEXT.md` in the current directory. The agent interviews you about your goals and open questions, then writes the file. `/do-research` reads it on every invocation to add a **Relevance** section tailored to your work.

```
/before-research
```

### `/do-research`

Imports a paper into Sidenote (or finds it if already there), reads it in multiple passes with full visual analysis, and writes structured notes with embedded PDF references.

```bash
# By URL (imports if not already in the library)
/do-research "https://arxiv.org/abs/1706.03762"

# By approximate title (finds an existing paper)
/do-research "attention is all you need"

# With a focus directive
/do-research "https://arxiv.org/abs/..." "focus on the training procedure, skip the ablations"
```

**What the agent does:**

```
Pass 1 — Orient      Read the paper text to map structure and locate key figures
Prepare              Render visual pages to images using pdftoppm
Pass 2 — Deep read   Read paper + images; write notes with PDF references
Review               Crop and verify every reference; patch anything wrong
```

**Notes structure** (fixed sections, agent-chosen subsections):

```markdown
## Overview
## Method
## Results
## Limitations
## Relevance   ← only present if RESEARCH_CONTEXT.md exists in the current directory
```

**System dependencies** (checked by `npm run setup`):

```bash
brew install poppler   # pdftoppm — renders PDF pages to images
pip install Pillow     # crops reference regions for verification
```

---

## Data

All data is stored locally and never leaves your machine:

| Path | Contents |
|---|---|
| `data/research.db` | SQLite database — papers, folders, notes |
| `data/pdfs/` | Cached PDF files |

Neither path is committed to the repo. Back them up manually if needed.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Database | SQLite via Drizzle ORM (`better-sqlite3`) |
| PDF viewer | pdf.js (`react-pdf`) |
| Notes editor | CodeMirror 6 (`@uiw/react-codemirror`) |
| Styling | Tailwind CSS v4 |
