# ADR-0002: Dedicated parsers for six primary sources; manual import fallback

## Status
Accepted

## Decision
The app has dedicated import parsers for six sources: arXiv, OpenReview, ACL Anthology, PMLR, CVF, and NeurIPS proceedings. For all other sources, the user manually enters metadata and uploads the PDF.

## Reasons
- These six sources cover the vast majority of ML papers a researcher would read.
- All six provide free, openly accessible PDFs and structured metadata (via API or predictable URL patterns).
- Generic web scraping (e.g. via Google Scholar) is fragile, against ToS, and ultimately resolves to one of these sources anyway.
- Manual import keeps the fallback simple and reliable without introducing brittle scraping logic.

## Consequences
- No automatic extraction for paywalled sources (IEEE Xplore, ACM DL, etc.).
- Semantic Scholar is not used as a primary source but could be used in future as a metadata lookup by DOI/title.
