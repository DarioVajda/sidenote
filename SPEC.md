# Sidenote — Spec

> Living document. Updated as decisions are made.

## Overview

A locally-run web app for managing notes on research papers. Runs entirely on the user's machine — no cloud, no accounts. All data (PDFs, notes, metadata) stored locally.

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js (TypeScript) | Full-stack, great defaults, TypeScript-first |
| Database | SQLite + Drizzle ORM | Zero-config, single file, persists between sessions |
| PDF viewer | pdf.js | Industry standard, works in-browser |

---

## Navigation

A persistent top nav bar with:
- **App logo/name** — always navigates to the Paper List
- **Theme toggle** (sun/moon icon) — switches between light and dark mode; preference saved to `localStorage`

---

## Views

### 1. Paper List (default / home)

Two-column layout: **Folder Sidebar** on the left, **Paper List** on the right.

**Folder Sidebar:**
- Resizable — drag the right edge to set width (min 160px, max 480px, default 208px)
- Top entry: **All Papers** (always visible, shows every non-trashed paper)
- Below: recursive folder tree, expand/collapse per node
- Bottom entry: **Trash** (always visible, shows count of items inside)
- Right-click a folder → context menu: New Subfolder / Rename / Delete
- Right-click sidebar background → New Folder (root level)
- `+` button in the sidebar header → New Folder (root level)
- Papers are also listed under their folders in the sidebar; clicking a paper in the sidebar navigates to its detail view
- Drag a paper card (from the sidebar only) onto a folder → moves paper to that folder
- Drag a folder onto another folder → moves entire subtree; cycle prevention enforced (cannot drop into own descendant)

**Paper List (right panel):**
- Papers sorted by date added, most recent first
- Each card shows: title, short description, authors, date added, Reading Status
- Authors are clickable — each links to a Google Scholar author profile search in a new tab
- "Add paper" button opens the Add Paper Modal
- Each card has on-hover actions: **copy BibTeX** (cite icon) and **delete** (trash icon)
  - Cite: copies a BibTeX citation to the clipboard; icon flashes to a checkmark for 1.5s
  - Delete: moves paper to Trash (no immediate permanent delete from the list)

**Trash view** (shown when Trash is selected in sidebar):
- Lists trashed papers with their trashed-at date and days remaining until auto-purge
- Per item: **Restore** button (returns paper to its previous folder) and **Delete permanently** button
- **Empty Trash** button at the top removes all items immediately
- On app load: papers trashed more than 30 days ago are purged silently

### 2. Paper Detail View

Split-screen layout with a header and body. Folder sidebar is **not shown** in this view.

**Header:**
- Title, authors, year, venue
- Authors are clickable — each links to a Google Scholar author profile search in a new tab
- **Cite button** (top-right of header) — copies a BibTeX citation to the clipboard; label changes to "Copied" for 1.5s

**Body:**
- PDF panel and Notes panel separated by a draggable divider (range 20–80% split)
- User can swap panel positions (PDF left/right) via a button on the divider
- PDF pages have a fixed base width set at mount time; resizing the panel only changes centering — pages never re-render on divider drag
- Notes editor uses soft line-wrapping (no horizontal scroll)

---

## Features

### Adding a Paper

Triggered via "Add paper" button → opens a modal (stays on the list page).

The modal includes a **Folder** picker defaulting to the currently selected folder in the sidebar (or root if "All Papers" is selected).

**Import is idempotent:** if a paper with the same arXiv ID or source URL already exists in the library (and is not trashed), the existing record is returned instead of creating a duplicate. This applies to both the UI and the API.

**Supported sources** (URL only required — metadata and PDF auto-extracted):
- arXiv
- OpenReview
- ACL Anthology
- PMLR (proceedings.mlr.press)
- CVF (openaccess.thecvf.com)
- NeurIPS proceedings (proceedings.neurips.cc)

**Manual import** (fallback for all other sources):
- User fills in: title, authors, year, venue, abstract
- User uploads PDF

**Import failure handling:**
- If auto-import fails, show error and drop into manual import form with any successfully extracted fields pre-filled

### Folders

- Recursive tree, any depth
- Each paper belongs to at most one folder
- Clicking a folder in the sidebar shows all papers in it and all descendants
- Papers and folders are both draggable to reorganise
- Deleting a folder: shows confirmation "Delete '[name]'? X papers will be moved to Trash." with Delete / Cancel. On confirm, all papers inside (at any depth) move to Trash.

### Trash

- All paper deletions go through Trash (from list card delete or folder deletion)
- Papers auto-purged 30 days after entering Trash
- User can restore or permanently delete individual papers at any time
- "Empty Trash" clears everything immediately
- Trash entry in sidebar shows current item count
- 30-day purge runs silently on app load

### Notes

- Free-form Markdown attached to each Paper
- Toggle between **edit mode** and **view (rendered) mode**
- **Autosaved** with ~1s debounce after the user stops typing
- Save status indicator (spinner / checkmark) appears to the left of the PDF reference toolbar button; hidden when idle

### PDF References

Anchors from notes text to rectangular regions of the PDF. Coordinates stored inline in the markdown as a `ref:` URI — no separate DB table.

**Format:** `[label](ref:page=2,x1=0.12,y1=0.34,x2=0.56,y2=0.78)`
Coordinates are normalized 0–1 relative to page dimensions (zoom-independent).

**Creating a reference — two trigger methods (edit mode only):**

1. **Toolbar button** — click "link to PDF" in the notes toolbar
   - If text is selected in the editor: that text becomes the label; selection mode activates immediately
   - If nothing is selected: selection mode activates; on rectangle draw, `[Insert text…](ref:…)` is inserted at the cursor with "Insert text…" pre-selected so the user can type to replace it

2. **Typing trigger** — type `[any text](ref:` in the editor
   - The moment `(ref:` is completed after a `]`, selection mode activates automatically
   - If the brackets contain text, that text becomes the label

**Selection mode behaviour (both triggers):**
- Everything outside the PDF panel dims subtly
- A short instruction appears at the top of the PDF panel ("Draw a rectangle to create a reference — Esc to cancel")
- User drags a rectangle over any region of the PDF
- On release: coordinates are captured, the `ref:` URI is completed, selection mode ends and dims clear
- Pressing Esc cancels: dims clear, editor returns to normal, no link inserted

**Using a reference (view mode):**
- PDF reference links render with a small distinct icon to distinguish them from regular URL links
- Clicking a reference link scrolls the PDF to the correct page and draws a highlight rectangle over the referenced region
- The highlight fades out after ~2 seconds

---

## Data Model

### Folder
| Field | Type | Notes |
|---|---|---|
| id | string (uuid) | |
| name | string | Display name |
| parent_id | string \| null | FK → Folder; null = root level |
| created_at | datetime | |

### Paper
| Field | Type | Notes |
|---|---|---|
| id | string (uuid) | |
| folder_id | string \| null | FK → Folder; null = unassigned |
| original_title | string | Extracted at import, never edited |
| description | string \| null | User-written summary for list card |
| abstract | string \| null | Extracted at import, never edited |
| authors | string | JSON array |
| year | number \| null | |
| venue | string \| null | Journal / conference |
| source_url | string \| null | Original URL the paper was imported from |
| arxiv_id | string \| null | |
| pdf_path | string | Path to locally cached PDF file |
| notes | string | Raw markdown (contains inline `ref:` URIs) |
| reading_status | enum | `to_read` \| `reading` \| `done` |
| trashed_at | datetime \| null | Set when moved to Trash; null = not in Trash |
| created_at | datetime | Used for timeline ordering |
| updated_at | datetime | |

### Theme

Stored in `localStorage` under the key `theme`. Values: `'light'` (default) | `'dark'`. Applied as a `dark` class on `<html>` before React hydration to prevent flash.

---

### BibTeX Export

Available in two places:
- **Paper list card** — cite icon (visible on hover), copies BibTeX to clipboard
- **Detail view header** — "Cite" button, copies BibTeX to clipboard

Generated format:
- `@article` for arXiv papers (includes `journal = {arXiv preprint arXiv:ID}`)
- `@inproceedings` for papers with a known venue
- `@misc` otherwise

Citation key format: `{firstAuthorLastName}{year}{firstSignificantTitleWord}` (lowercased, diacritics stripped).

---

## Out of Scope (for now)

- Citation graph
- Cloud sync / collaboration
- Search and filtering
- Tags
