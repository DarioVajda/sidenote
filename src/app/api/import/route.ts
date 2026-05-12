import { NextRequest, NextResponse } from 'next/server';
import { importFromUrl } from '@/lib/importers';
import { detectArxivId } from '@/lib/importers/arxiv';
import { db } from '@/lib/db';
import { papers } from '@/lib/db/schema';
import { eq, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { serializePaper } from '@/lib/db/serialize';

export async function POST(request: NextRequest) {
  try {
    const { url, folderId } = await request.json();
    if (!url?.trim()) return NextResponse.json({ error: 'URL is required' }, { status: 400 });

    const trimmedUrl = url.trim();

    // Return existing non-trashed paper without re-downloading
    const arxivId = detectArxivId(trimmedUrl);
    const matchCondition = arxivId
      ? or(eq(papers.arxivId, arxivId), eq(papers.sourceUrl, trimmedUrl))
      : eq(papers.sourceUrl, trimmedUrl);
    const candidates = await db.select().from(papers).where(matchCondition).limit(5);
    const existing = candidates.find(p => !p.trashedAt);
    if (existing) return NextResponse.json(serializePaper(existing), { status: 200 });

    const imported = await importFromUrl(trimmedUrl);
    const now = new Date();

    const [paper] = await db.insert(papers).values({
      id: randomUUID(),
      folderId: folderId ?? null,
      originalTitle: imported.originalTitle,
      customTitle: null,
      description: null,
      abstract: imported.abstract,
      authors: JSON.stringify(imported.authors),
      year: imported.year,
      venue: imported.venue,
      sourceUrl: imported.sourceUrl,
      arxivId: imported.arxivId,
      pdfPath: imported.pdfPath,
      notes: '',
      readingStatus: 'to_read',
      createdAt: now,
      updatedAt: now,
    }).returning();

    return NextResponse.json(serializePaper(paper), { status: 201 });
  } catch (err) {
    let message = err instanceof Error ? err.message : 'Import failed';
    if (message === 'fetch failed') message = 'Could not reach the source. Check your connection and try again.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
