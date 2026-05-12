import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { folders, papers } from '@/lib/db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { serializeFolder } from '@/lib/db/serialize';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const update: Partial<typeof folders.$inferInsert> = {};
  if ('name' in body && body.name?.trim()) update.name = body.name.trim();
  if ('parentId' in body) update.parentId = body.parentId ?? null;
  const [updated] = await db.update(folders).set(update).where(eq(folders.id, id)).returning();
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(serializeFolder(updated));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  // Collect folder + all descendants via BFS
  const allFolders = await db.select({ id: folders.id, parentId: folders.parentId }).from(folders);
  const toDelete: string[] = [];
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    toDelete.push(current);
    allFolders.filter(f => f.parentId === current).forEach(f => queue.push(f.id));
  }

  // Move all non-trashed papers in those folders to trash
  const now = new Date();
  for (const fid of toDelete) {
    await db.update(papers)
      .set({ trashedAt: now })
      .where(and(eq(papers.folderId, fid), isNull(papers.trashedAt)));
  }

  // Delete folder — cascade in DB handles descendant folders
  await db.delete(folders).where(eq(folders.id, id));
  return NextResponse.json({ success: true });
}
