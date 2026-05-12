import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { papers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { serializePaper } from '@/lib/db/serialize';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const [updated] = await db.update(papers)
    .set({ trashedAt: null })
    .where(eq(papers.id, id))
    .returning();
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(serializePaper(updated));
}
