import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { papers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { serializePaper } from '@/lib/db/serialize';
import fs from 'fs/promises';
import path from 'path';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const [paper] = await db.select().from(papers).where(eq(papers.id, id));
  if (!paper) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(serializePaper(paper));
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const now = new Date();

  const update: Partial<typeof papers.$inferInsert> = { updatedAt: now };
  if ('customTitle' in body) update.customTitle = body.customTitle;
  if ('description' in body) update.description = body.description;
  if ('readingStatus' in body) update.readingStatus = body.readingStatus;
  if ('notes' in body) update.notes = body.notes;
  if ('authors' in body) update.authors = JSON.stringify(body.authors);
  if ('year' in body) update.year = body.year;
  if ('venue' in body) update.venue = body.venue;
  if ('folderId' in body) update.folderId = body.folderId;

  const [updated] = await db.update(papers).set(update).where(eq(papers.id, id)).returning();
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(serializePaper(updated));
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const permanent = searchParams.get('permanent') === 'true';

  const [paper] = await db.select().from(papers).where(eq(papers.id, id));
  if (!paper) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (permanent) {
    await db.delete(papers).where(eq(papers.id, id));
    try {
      await fs.unlink(path.join(process.cwd(), 'data', paper.pdfPath));
    } catch { /* file may already be gone */ }
  } else {
    await db.update(papers).set({ trashedAt: new Date() }).where(eq(papers.id, id));
  }

  return NextResponse.json({ success: true });
}
