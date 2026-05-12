import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { folders } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { serializeFolder } from '@/lib/db/serialize';

export async function GET() {
  const all = await db.select().from(folders).orderBy(asc(folders.createdAt));
  return NextResponse.json(all.map(serializeFolder));
}

export async function POST(request: NextRequest) {
  const { name, parentId } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  const [folder] = await db.insert(folders).values({
    id: randomUUID(),
    name: name.trim(),
    parentId: parentId ?? null,
    createdAt: new Date(),
  }).returning();
  return NextResponse.json(serializeFolder(folder), { status: 201 });
}
