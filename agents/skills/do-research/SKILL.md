---
name: do-research
description: Reads a research paper thoroughly and writes structured notes into the Sidenote app. Accepts a paper URL (arXiv, ACL, etc.) or an approximate title of a paper already in the library. Uses a 4-pass pipeline: orient, prepare visuals, deep read + write notes with PDF references, review + patch.
---

# do-research

You are a meticulous research analyst. Your job is to read the given paper and produce notes that fully substitute for reading it — the user should be able to read your notes instead of the paper, then use the PDF references you embed to verify specific claims.

## Setup

**App base URL:** `http://localhost:3000` (override with `NOTES_APP_URL` env var if set)

Locate the Sidenote repo root and research context directory:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
RESEARCH_DIR="$REPO_ROOT/research_context"
```

**Focus directive:** The user may pass an optional instruction after the paper identifier, e.g.:
`/do-research "paper title" "focus on the graph tokenization mechanism, skip ablations"`
If present, treat this as a focus directive: allocate extra depth to the named topics and actively de-prioritise everything marked as skippable. Use it to shape both note depth and the Relevance section.

## Step 0 — Parse invocation and pre-resolve project

Parse the full invocation text for:

1. **Paper identifier** — URL, title, or citation string.
2. **Focus directive** — an optional quoted instruction (e.g. `"focus on X, skip Y"`).
3. **Project hint** — natural language phrases like *"add to project X"*, *"for project X"*, *"in project X"*, *"project: X"*.

If a project hint is found, resolve it now:

```bash
ls "$RESEARCH_DIR" 2>/dev/null
```

Find the directory whose name best matches the hint (fuzzy/substring match). Read its frontmatter:

```bash
grep 'folder_id:' "$RESEARCH_DIR/<matched_dir>/RESEARCH_CONTEXT.md"
```

Store: `project_dir = <matched_dir>`, `project_folder_id = <id>`.

If no project hint is found, set `project_dir = null`, `project_folder_id = null` for now — resolution happens after Step 1.

## Step 1 — Resolve the paper

The user's input is one of: a URL, an approximate title, or a full citation string (e.g. `Vaswani et al., "Attention Is All You Need", NeurIPS 2017`). An optional quoted focus directive may follow.

**If it looks like a URL:** check the local library first (see title/citation path below), then import if not found.

**If it looks like a title or citation string:**

1. **Check the local library first:**
   ```
   GET {base}/api/papers
   ```
   Fuzzy-match against `originalTitle` and `customTitle`. If a confident match is found, use that paper — set `paper_is_new = false`, extract `id` and `folderId`. Skip the import steps.

2. **Infer a direct URL from the citation.** If the input includes enough metadata (venue, year, authors), reason about where the canonical version lives:
   - NeurIPS / ICML / ICLR / ACL / EMNLP / NAACL / CVPR / ICCV / ECCV / AAAI and most ML/NLP/CV venues → try `https://arxiv.org/search/?query=<title>&searchtype=all`; fetch the page and extract the first result's `/abs/` link, then convert to `https://arxiv.org/pdf/<id>`
   - ACL Anthology venues (ACL, EMNLP, NAACL, EACL, etc.) → also try `https://aclanthology.org/search/?q=<title>` for a direct PDF
   - If the DOI is known or inferable (e.g. from a journal citation), try `https://doi.org/<doi>`

3. **arXiv search fallback.** If no URL could be inferred or the import failed, search the arXiv API:
   ```
   https://export.arxiv.org/api/query?search_query=ti:<title terms>&max_results=3
   ```
   Parse the Atom XML response, pick the best title match, extract its `<id>` URL (convert `/abs/` → `/pdf/` for the import), and use that URL.

4. **Google Scholar fallback.** If arXiv returns no useful results, construct a search URL and ask the user to locate the PDF:
   ```
   https://scholar.google.com/scholar?q=<url-encoded title and authors>
   ```
   Print: "Couldn't locate a PDF automatically. Try this Scholar search: <url> — paste the PDF or abstract URL here and I'll continue."
   Wait for the user to provide a URL, then use it.

**Before importing a new paper:** if `project_folder_id` is still null (no hint was given), resolve the project now:

```bash
ls "$RESEARCH_DIR" 2>/dev/null
```

List the existing project directories and ask the user: *"Which research project should this paper be added to?"* Include a **"No project / skip"** option. If the user picks a project, read its frontmatter and set `project_dir` and `project_folder_id`.

**Import the paper:**

```
POST {base}/api/import
{"url": "<url>", "folderId": "<project_folder_id or omit if null>"}
```

Response: status 200 = already existed, 201 = freshly imported. Extract `id`. Set `paper_is_new = (status == 201)`.

Once you have the paper ID, download the PDF to a temp file:

```bash
curl -s "{base}/api/papers/{id}/pdf" -o /tmp/paper_{id}.pdf
```

Confirm the file exists and is non-empty:

```bash
ls -lh /tmp/paper_{id}.pdf
```

The local path `/tmp/paper_{id}.pdf` is your PDF for all subsequent steps.

## Research context

After Step 1, load the research context as follows:

**If `project_dir` is already resolved** (from a hint or user choice during import): read `$RESEARCH_DIR/{project_dir}/RESEARCH_CONTEXT.md`. Use it for the Relevance section and Further Reading ranking.

**If `project_dir` is null and `paper_is_new = false`** (paper was already in the library):
- From the paper object, get `folderId`.
- If `folderId` is null: no project. Print *"No research project associated with this paper. Proceeding without Relevance section."* and continue.
- Otherwise, get all folders: `GET {base}/api/folders`. Walk up from `folderId` by following `parentId` until `parentId` is null — that is the top-level folder. Note its `id` as `top_folder_id`.
- Scan all `RESEARCH_CONTEXT.md` files for a matching `folder_id`:
  ```bash
  grep -rl "folder_id: <top_folder_id>" "$RESEARCH_DIR" 2>/dev/null
  ```
- If found, set `project_dir` to the containing directory name and read the file. If not found, print *"No research context found for this paper's project folder. Proceeding without Relevance section."* and continue.

## Step 2 — Pass #1: Orient (text only)

Read the PDF using the Read tool:
```
Read /tmp/paper_{id}.pdf
```

Goal: understand the paper's structure without yet writing notes. Specifically:
- What is the core problem and claimed contribution?
- What are the main sections and their rough page ranges?
- Which pages contain key visual elements (architecture diagrams, result tables, figures, algorithm boxes)? Note these page numbers explicitly — you will render them as images in Step 3.

Do not write notes yet. Build a mental map only.

## Step 3 — Prepare visuals

For each page identified in Pass #1 as containing a key visual, render it to a PNG at 200 dpi:

```bash
pdftoppm -r 200 -f <page> -l <page> -png /tmp/paper_{id}.pdf /tmp/paper_{id}_p<page>
```

After running, find the actual output filename (pdftoppm zero-pads page numbers):
```bash
ls /tmp/paper_{id}_p<page>*.png
```

Read each PNG with the Read tool to confirm it loaded. Keep a list of `{ page: N, imagePath: "<actual path>" }` for use in Pass #2.

## Step 4 — Pass #2: Deep read + write notes

Read the paper section by section, consulting the relevant page images as you go. Treat every figure, table, and chart as primary evidence.

### Length targets

Write tight. Every sentence must earn its place.

- **Overview:** 4–6 sentences maximum
- **Method:** cover only the 2–4 most important components; skip minor implementation details
- **Baselines:** 2–5 bullet points, one per baseline
- **Results:** the 3–5 numbers that matter most; one sentence of context per result
- **Limitations:** 3–5 bullet points
- **Relevance:** 3–6 bullet points mapping the paper to Key Questions
- **Further Reading:** 3–6 entries, ranked by importance

Total notes should be readable in under 10 minutes.

### Notes format

Exactly these `##` sections in this order. Add `###` subsections within any section as needed. Omit `## Relevance` entirely if no research context was found.

```markdown
## Overview

[4–6 sentences. Problem, approach, key claim. Dense enough that a reader understands the paper's position without reading anything else.]

## Method

[The 2–4 most important components only. Enough detail to understand the approach. Use ### subsections for distinct components. Skip minor details.]

## Baselines

[Bullet list. One entry per baseline the authors compare against. For each: name, one sentence on what it is and why it is a meaningful point of comparison. Every entry must carry a PDF reference anchored to where the baseline is introduced or the comparison table appears.]

## Results

[3–5 key results with numbers. What the numbers actually mean. Every number must be anchored to its source in the paper.]

## Limitations

[Bullet list. What the authors concede + what you independently observe.]

## Relevance

[Only if research context exists. Bullet list mapping each Key Question to what the paper says about it. End with a "Watch out for:" line if relevant.]

## Further Reading

[3–6 papers from the bibliography, ranked by relevance. See instructions below.]
```

### Mathematics

Write all mathematical expressions in LaTeX. Use `$...$` for inline math and `$$...$$` for display equations. Never write equations in plain text.

### Embedding PDF references

**Every claim a reader might want to verify must be anchored with a PDF reference.** This is not limited to figures and tables — inline claims in running text are equally important. Specific numbers, architectural choices, training details, comparisons, ablation observations, and limitations all need references. The purpose of these notes is to let the reader verify any claim by clicking a single link, rather than having to search the paper manually. Dense reference coverage is a core quality signal.

```
[link text](ref:page=N,x1=X,y1=Y,x2=X2,y2=Y2)
```

- `page` = 1-indexed page number
- `x1, y1` = top-left corner, normalized 0–1 (0,0 = top-left of page)
- `x2, y2` = bottom-right corner, normalized 0–1

**STRICT RULE — link text is 1–4 words. No exceptions.**

Using a sentence or clause as link text is strictly prohibited. It breaks the UI and makes the notes unreadable. If you find yourself writing more than 4 words inside `[...]`, stop and use `[(ref)]` instead.

The only two legal patterns are:

```markdown
The model achieves 84.2% accuracy [on ImageNet](ref:page=4,...).
The model achieves 84.2% accuracy using a two-layer cross-attention block. [(ref)](ref:page=4,...)
```

**Rule:** if a natural 1–4 word anchor exists in the sentence (a number, a name, a short term), use it as the link text. If no short anchor fits naturally, append `[(ref)](ref:...)` at the end of the sentence — never stretch the link text to make it "fit". When in doubt, use `[(ref)]`.

**Estimating coordinates:** Before writing any coordinates, study the full page image carefully and reason explicitly about the bounding box: identify the element's top, bottom, left, and right edges as fractions of page height/width. State this reasoning in one sentence before writing the coordinates — "The results table runs full width, top edge at roughly y=0.42, bottom at y=0.71" → `x1=0.03,y1=0.42,x2=0.97,y2=0.71`. The goal is to get the box right on the first attempt through careful analysis.

Aim for dense coverage: at minimum one PDF reference per `###` subsection, but typically several. Architecture diagrams, result tables, ablation tables, and every specific number or claim in the text must be referenced.

### Further Reading

While reading the paper, note which referenced works are cited most prominently — introduced in the abstract or introduction as direct predecessors, used as primary baselines, described in dedicated related-work paragraphs, or cited repeatedly across multiple sections. These signal the papers the authors considered most load-bearing.

After the deep read, select 3–6 of those works for the Further Reading section. Rank them as follows:

1. **If research context exists:** rank primarily by how well the paper maps to the Key Questions and research goals, then secondarily by how central it was to the target paper.
2. **If no context exists:** rank purely by how central the paper was to the target paper (frequency of citation, role as baseline or foundation).

For each entry, include:
- Full citation: title, all authors as listed in the bibliography, year, venue/journal, and volume/pages if present
- One sentence on its role in the target paper (e.g. "primary baseline for the main results table", "introduced the architecture this work extends")
- If research context exists and the paper is relevant to your research: one sentence on why
- A `/do-research` prompt block so a future agent can pick it up immediately. Include the project if one is active.

Format:

```markdown
## Further Reading

- **Title** · Firstname Lastname, Firstname Lastname · Year · Venue
  Full citation: Lastname, F., Lastname, F., et al. "Title." *Venue* (Year).
  Role in this paper: [one sentence].
  [Relevance to your research: one sentence. — only if research context exists and relevant]

  ```prompt
  /do-research read "Lastname et al., 'Title', Venue Year" and add to project <project_dir>. [specific focus directive: what to zoom in on, what to skip, and why it matters for the research agenda]
  ```

- ...
```

If no project is active (no `project_dir`), omit the "and add to project ..." clause entirely.

**Writing the focus directive:** Combine two things — (1) what aspect of this paper was most load-bearing in the current work (the baseline it provides, the technique it introduces, the dataset it defines), and (2) which Key Question from the research context it most directly speaks to. The directive should read as a concrete instruction: "focus on X because it bears on Y", not "this paper is interesting". If no research context exists, base the directive purely on what angle would be most useful given the current paper's findings.

### Write the notes

Once you have read everything, write the complete notes and save:

```
PUT {base}/api/papers/{id}
{"notes": "<full markdown notes>"}
```

## Step 5 — Review + patch

For every PDF reference in the saved notes, verify and refine it through up to 3 rounds:

1. Ensure the page image is rendered (render it now if not already cached).

2. Crop the referenced region **expanded by 30% on every side** so you can see both the reference box and its immediate surroundings:

```bash
python3 - <<'EOF'
from PIL import Image
img = Image.open("<imagePath>")
w, h = img.size
x1, y1, x2, y2 = X1, Y1, X2, Y2
xm, ym = (x2 - x1) * 0.30, (y2 - y1) * 0.30
cx1, cy1 = max(0.0, x1 - xm), max(0.0, y1 - ym)
cx2, cy2 = min(1.0, x2 + xm), min(1.0, y2 + ym)
crop = img.crop((int(cx1*w), int(cy1*h), int(cx2*w), int(cy2*h)))
crop.save("/tmp/verify_crop.png")
print(f"Image: {w}x{h}. Margined crop: ({int(cx1*w)},{int(cy1*h)}) → ({int(cx2*w)},{int(cy2*h)})")
EOF
```

3. Read `/tmp/verify_crop.png`. The 30% margin lets you see what is just outside the reference box. Assess:
   - Is the intended element (figure, equation, table row, sentence) fully captured, or clipped?
   - Is the box capturing extra unrelated content above, below, or beside it?
   - Is the box offset — does the visible margin reveal that the element starts outside the current box?

4. Also verify the claim itself — does the paper actually say this? If not, fix the text.

**If the crop looks correct, move on immediately — do not re-crop.**

If the crop reveals a clear, specific problem (e.g. "the top of the table is cut off" or "there is an unrelated paragraph below"), name the exact problem, state the corrected coordinates with reasoning, update, and run one more crop to confirm. Only run a third round if the second crop still shows a specific named error. The goal is one well-reasoned crop that confirms a carefully estimated box — not iterative guessing.

Fix errors immediately via `PUT` before moving to the next reference.

Once all references pass, print: "Notes written for [paper title]. N PDF references embedded."
