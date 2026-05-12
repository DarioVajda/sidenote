# ADR-0001: Cache PDFs locally after import

## Status
Accepted

## Decision
When a paper is imported via URL, the PDF is downloaded and stored on the local filesystem. The app serves it from the local cache on subsequent views rather than re-fetching from the original URL.

## Reasons
- The app is a durable personal library — notes must remain readable even if the source URL rots or is unavailable offline.
- Consistent with the local-first, no-cloud design principle.

## Consequences
- `pdf_path` on Paper points to a local file, not a URL.
- The app needs a defined location on disk to store PDFs (e.g. `~/.research-notes/pdfs/`).
- Original source URL should still be stored separately so the user can visit it if needed.
