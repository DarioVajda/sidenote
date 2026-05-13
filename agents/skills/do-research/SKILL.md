---
name: do-research
description: Reads a research paper thoroughly and writes structured notes into the Sidenote app. Accepts a paper URL (arXiv, ACL, etc.) or an approximate title of a paper already in the library. Uses a 4-pass pipeline: orient, prepare visuals, deep read + write notes with PDF references, review + patch.
---

# do-research

You are a meticulous research analyst. Your job is to read the given paper and produce notes that fully substitute for reading it — the user should be able to read your notes instead of the paper, then use the PDF references you embed to verify specific claims.

## Setup

**App base URL:** `http://localhost:3000` (override with `NOTES_APP_URL` env var if set)

**Research context:** Check for `RESEARCH_CONTEXT.md` in the current working directory. If absent, print one line — "No RESEARCH_CONTEXT.md found. Run /before-research to add research context. Proceeding without Relevance section." — and continue.

**Focus directive:** The user may pass an optional instruction after the paper identifier, e.g.:
`/do-research "paper title" "focus on the graph tokenization mechanism, skip ablations"`
If present, treat this as a focus directive: allocate extra depth to the named topics and actively de-prioritise everything marked as skippable. Use it to shape both note depth and the Relevance section.

## Step 1 — Resolve the paper

The user's input is either a URL or an approximate paper title, with an optional quoted focus directive after it.

**If it looks like a URL:**
```
POST {base}/api/import
{"url": "<url>"}
```
Response is the paper object (status 200 = already existed, 201 = freshly imported). Extract `id`.

**If it looks like a title/description:**
```
GET {base}/api/papers
```
Fuzzy-match the user's description against `originalTitle` and `customTitle` fields. Pick the closest match. If no match is found, tell the user you couldn't find it and ask for a URL.

Once you have the paper ID, download the PDF to a temp file:

```bash
curl -s "{base}/api/papers/{id}/pdf" -o /tmp/paper_{id}.pdf
```

Confirm the file exists and is non-empty:
```bash
ls -lh /tmp/paper_{id}.pdf
```

The local path `/tmp/paper_{id}.pdf` is your PDF for all subsequent steps.

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
- **Results:** the 3–5 numbers that matter most; one sentence of context per result
- **Limitations:** 3–5 bullet points
- **Relevance:** 3–6 bullet points mapping the paper to Key Questions
- **Further Reading:** 3–6 entries, ranked by importance

Total notes should be readable in under 10 minutes.

### Notes format

Exactly these `##` sections in this order. Add `###` subsections within any section as needed. Omit `## Relevance` entirely if no `RESEARCH_CONTEXT.md` was found.

```markdown
## Overview

[4–6 sentences. Problem, approach, key claim. Dense enough that a reader understands the paper's position without reading anything else.]

## Method

[The 2–4 most important components only. Enough detail to understand the approach. Use ### subsections for distinct components. Skip minor details.]

## Results

[3–5 key results with numbers. Baselines compared against. What the numbers actually mean.]

## Limitations

[Bullet list. What the authors concede + what you independently observe.]

## Relevance

[Only if RESEARCH_CONTEXT.md exists. Bullet list mapping each Key Question to what the paper says about it. End with a "Watch out for:" line if relevant.]

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

1. **If `RESEARCH_CONTEXT.md` exists:** rank primarily by how well the paper maps to the Key Questions and research goals, then secondarily by how central it was to the target paper.
2. **If no context exists:** rank purely by how central the paper was to the target paper (frequency of citation, role as baseline or foundation).

For each entry, include:
- Full title and authors (as they appear in the bibliography)
- Year and venue if available
- One sentence on its role in the target paper (e.g. "primary baseline for the main results table", "introduced the architecture this work extends")
- If `RESEARCH_CONTEXT.md` exists and the paper is relevant to your research: one sentence on why

Format:

```markdown
## Further Reading

- **Title** · Authors · Year · Venue
  Role in this paper: [one sentence].
  [Relevance to your research: one sentence. — only if RESEARCH_CONTEXT.md exists and relevant]

- ...
```

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
