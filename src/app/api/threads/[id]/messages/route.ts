import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { threads, messages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { serializeMessage } from '@/lib/db/serialize';
import { randomUUID } from 'crypto';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const [thread] = await db.select({ id: threads.id }).from(threads).where(eq(threads.id, id));
  if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { role, content } = body;
  if (!role || !content) return NextResponse.json({ error: 'role and content required' }, { status: 400 });
  if (role !== 'user' && role !== 'assistant') return NextResponse.json({ error: 'role must be user or assistant' }, { status: 400 });

  const [msg] = await db
    .insert(messages)
    .values({ id: randomUUID(), threadId: id, role, content, createdAt: new Date() })
    .returning();

  return NextResponse.json(serializeMessage(msg), { status: 201 });
}
