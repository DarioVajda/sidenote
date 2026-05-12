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

Total notes should be readable in under 10 minutes.

### Notes format

Exactly these five `##` sections. Add `###` subsections within any section as needed. Omit `## Relevance` entirely if no `RESEARCH_CONTEXT.md` was found.

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
```

### Mathematics

Write all mathematical expressions in LaTeX. Use `$...$` for inline math and `$$...$$` for display equations. Never write equations in plain text.

### Embedding PDF references

Every significant factual claim in Method and Results must be anchored with a PDF reference:

```
[link text](ref:page=N,x1=X,y1=Y,x2=X2,y2=Y2)
```

- `page` = 1-indexed page number
- `x1, y1` = top-left corner, normalized 0–1 (0,0 = top-left of page)
- `x2, y2` = bottom-right corner, normalized 0–1

**Estimating coordinates:** Look at the rendered PNG. Identify the target element's bounding box as fractions of the image width and height. Add ~3% padding on each side. State your reasoning explicitly before writing the coordinates: "The results table spans the full width, from roughly y=0.42 to y=0.71" → `x1=0.03,y1=0.42,x2=0.97,y2=0.71`.

Aim for at least one PDF reference per `###` subsection. Architecture diagrams, result tables, and ablation tables must always be referenced.

### Write the notes

Once you have read everything, write the complete notes and save:

```
PUT {base}/api/papers/{id}
{"notes": "<full markdown notes>"}
```

## Step 5 — Review + patch

For every PDF reference in the saved notes, verify it precisely:

1. Ensure the page image is rendered (render it now if not already cached).
2. Crop the referenced region from the image using Python:

```bash
python3 - <<'EOF'
from PIL import Image
img = Image.open("<imagePath>")
w, h = img.size
crop = img.crop((int(X1*w), int(Y1*h), int(X2*w), int(Y2*h)))
crop.save("/tmp/verify_crop.png")
print(f"Crop saved: {w}x{h}px image, region ({int(X1*w)},{int(Y1*h)}) to ({int(X2*w)},{int(Y2*h)})")
EOF
```

3. Read `/tmp/verify_crop.png`. The crop must clearly show the intended element (figure, table, equation). If it shows mostly whitespace, a wrong element, or is cut off, the coordinates are wrong — go back to the full page image, restate your bounding box reasoning, and recompute.

4. Also verify the claim itself — does the paper actually say this? If not, fix the text.

Fix errors immediately via `PUT` before moving to the next reference.

Once all references pass, print: "Notes written for [paper title]. N PDF references embedded."
