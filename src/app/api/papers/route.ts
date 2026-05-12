import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { papers } from '@/lib/db/schema';
import { desc, isNull } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { serializePaper } from '@/lib/db/serialize';

export async function GET() {
  try {
    const all = await db.select().from(papers)
      .where(isNull(papers.trashedAt))
      .orderBy(desc(papers.createdAt));
    return NextResponse.json(all.map(serializePaper));
  } catch {
    return NextResponse.json({ error: 'Failed to fetch papers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const now = new Date();
    const [paper] = await db.insert(papers).values({
      id: randomUUID(),
      folderId: body.folderId ?? null,
      originalTitle: body.originalTitle,
      customTitle: body.customTitle ?? null,
      description: body.description ?? null,
      abstract: body.abstract ?? null,
      authors: JSON.stringify(body.authors ?? []),
      year: body.year ?? null,
      venue: body.venue ?? null,
      sourceUrl: body.sourceUrl ?? null,
      arxivId: body.arxivId ?? null,
      pdfPath: body.pdfPath,
      notes: '',
      readingStatus: 'to_read',
      createdAt: now,
      updatedAt: now,
    }).returning();
    return NextResponse.json(serializePaper(paper), { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create paper' }, { status: 500 });
  }
}
