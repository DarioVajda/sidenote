import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { threads, messages, papers } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { serializeThread, serializeMessage } from '@/lib/db/serialize';
import { randomUUID } from 'crypto';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const [paper] = await db.select({ id: papers.id }).from(papers).where(eq(papers.id, id));
  if (!paper) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const paperThreads = await db
    .select()
    .from(threads)
    .where(eq(threads.paperId, id))
    .orderBy(desc(threads.createdAt));

  const result = await Promise.all(
    paperThreads.map(async (t) => {
      const msgs = await db
        .select()
        .from(messages)
        .where(eq(messages.threadId, t.id))
        .orderBy(messages.createdAt);
      return { ...serializeThread(t), messages: msgs.map(serializeMessage) };
    }),
  );

  return NextResponse.json(result);
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const [paper] = await db.select({ id: papers.id }).from(papers).where(eq(papers.id, id));
  if (!paper) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [thread] = await db
    .insert(threads)
    .values({ id: randomUUID(), paperId: id, createdAt: new Date() })
    .returning();

  return NextResponse.json(serializeThread(thread), { status: 201 });
}
