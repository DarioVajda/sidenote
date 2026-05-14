---
name: before-research
description: Sets up or updates a RESEARCH_CONTEXT.md for a research project in the Sidenote app. Each project maps to a top-level Sidenote folder. Run before using /do-research.
---

# before-research

Your job is to set up or update a research context file for a project in the Sidenote app. Research contexts live at `research_context/{project_dir}/RESEARCH_CONTEXT.md` inside the Sidenote repo.

## App setup

**App base URL:** `http://localhost:3000` (override with `NOTES_APP_URL` env var if set)

Locate the Sidenote repo root and research context directory:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
RESEARCH_DIR="$REPO_ROOT/research_context"
```

## Step 1 — Choose a project

List existing research projects:

```bash
ls "$RESEARCH_DIR" 2>/dev/null
```

Ask the user: **"Which project is this for?"**

- If existing projects are found, list them by directory name and offer **"Create a new project"** as the final option.
- If no projects exist yet, tell the user and go straight to new project creation.

Wait for the user's answer before continuing.

### If creating a new project

Ask the following questions one at a time:

1. "What should we call this project directory? Use lowercase-with-hyphens, e.g. `rl-for-hpc`."
2. "What should the Sidenote folder be called? (display name shown in the app, e.g. `RL for HPC`)"

Then create the Sidenote folder:

```
POST {base}/api/folders
{"name": "<display name>"}
```

Extract the `id` from the response — this is the `folder_id` that permanently links the directory to the app folder.

Create the local directory:

```bash
mkdir -p "$RESEARCH_DIR/<project_dir>"
```

Set `existing_content = null`. Proceed to Step 2.

### If updating an existing project

Read the existing file:

```bash
cat "$RESEARCH_DIR/<project_dir>/RESEARCH_CONTEXT.md"
```

Extract the `folder_id` from the frontmatter (the `folder_id:` line between the `---` delimiters). Fetch the folder's current display name from the API: `GET {base}/api/folders`, find the entry with matching `id`, and use its `name` field.

Set `existing_content` = the content below the closing `---`. Proceed to Step 2.

## Step 2 — Interview

Ask the following questions **one at a time**, waiting for the user's answer before proceeding.

**If updating an existing project (`existing_content` is not null):** for each question, show the current answer from the file first, then ask: *"Keep this, or would you like to change it?"* Only update sections where the user provides a new answer.

**If creating a new project:** ask each question cold, with no pre-fill.

After each answer, ask one clarifying follow-up if the answer is vague or too broad — but only one. Do not batch questions.

1. **Research goal:** "What problem are you working on and what are you trying to build or prove? Give me a paragraph — the more specific the better."

2. **Key questions:** "What are the specific open questions you're currently trying to answer? List them — one per line."

3. **Methods and approaches:** "What methods or approaches are you currently exploring or have already committed to? (e.g. specific architectures, training strategies, datasets)"

4. **Out of scope:** "What are you explicitly NOT interested in right now? This helps the agent avoid wasting depth on irrelevant sections."

5. **Adjacent areas:** "Are there any closely related research areas or communities you're watching even if they're not your direct focus?"

## Step 3 — Write the file

Write `$RESEARCH_DIR/<project_dir>/RESEARCH_CONTEXT.md` with this exact format:

```markdown
---
folder_id: <folder_id>
---

## Research Goal

<synthesised paragraph from answer 1, written in second person as "You are working on...">

## Key Questions

<bullet list from answer 2, each question as a single crisp line>

## Methods & Approaches

<bullet list from answer 3>

## Out of Scope

<bullet list from answer 4>

## Adjacent Areas

<bullet list from answer 5, omit section entirely if the user said none>
```

Keep each section tight — this file is read by an agent on every paper analysis, so clarity and specificity matter more than completeness. If the user gave vague answers, sharpen them before writing.

Then write `$RESEARCH_DIR/<project_dir>/PROJECT_SUMMARY.md` — a human-readable summary displayed in the Sidenote app when this project folder is selected:

```markdown
# <folder display name from API>

<One or two narrative paragraphs synthesising the research goal and methods. Written as a project brief a colleague could read in 30 seconds to understand what you're working on. Prose only — no bullet points here.>

## Key Questions

- <Question 1, written as a full readable sentence>
- <Question 2>
- ...

**Focus:** <One sentence describing the primary methods or approaches being used.>
```

Confirm: "Research context written to `research_context/<project_dir>/`. Run /do-research to analyse a paper with this context."
