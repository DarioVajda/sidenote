import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { papers } from '@/lib/db/schema';
import { isNotNull, desc } from 'drizzle-orm';
import { serializePaper } from '@/lib/db/serialize';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  const trashed = await db.select().from(papers)
    .where(isNotNull(papers.trashedAt))
    .orderBy(desc(papers.trashedAt));
  return NextResponse.json(trashed.map(serializePaper));
}

export async function DELETE() {
  const trashed = await db.select({ id: papers.id, pdfPath: papers.pdfPath })
    .from(papers)
    .where(isNotNull(papers.trashedAt));

  for (const p of trashed) {
    try {
      await fs.unlink(path.join(process.cwd(), 'data', p.pdfPath));
    } catch { /* file may already be gone */ }
  }

  await db.delete(papers).where(isNotNull(papers.trashedAt));
  return NextResponse.json({ success: true });
}
