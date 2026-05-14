import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { folders } from '@/lib/db/schema';
import fs from 'fs';
import path from 'path';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  // Walk up parentId chain to find top-level ancestor
  const allFolders = await db.select({ id: folders.id, parentId: folders.parentId }).from(folders);
  const folderMap = new Map(allFolders.map(f => [f.id, f]));

  let current = folderMap.get(id);
  if (!current) return NextResponse.json({ markdown: null });

  while (current.parentId !== null) {
    const parent = folderMap.get(current.parentId);
    if (!parent) break;
    current = parent;
  }

  const topFolderId = current.id;

  // Scan research_context/ for a dir whose RESEARCH_CONTEXT.md frontmatter matches
  const researchDir = path.join(process.cwd(), 'research_context');
  if (!fs.existsSync(researchDir)) return NextResponse.json({ markdown: null });

  const projectDirs = fs.readdirSync(researchDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const dir of projectDirs) {
    const contextPath = path.join(researchDir, dir, 'RESEARCH_CONTEXT.md');
    if (!fs.existsSync(contextPath)) continue;

    const contextContent = fs.readFileSync(contextPath, 'utf-8');
    const match = contextContent.match(/^---[\s\S]*?folder_id:\s*([^\n]+)[\s\S]*?---/);
    if (!match || match[1].trim() !== topFolderId) continue;

    const summaryPath = path.join(researchDir, dir, 'PROJECT_SUMMARY.md');
    if (!fs.existsSync(summaryPath)) return NextResponse.json({ markdown: null });

    const markdown = fs.readFileSync(summaryPath, 'utf-8');
    return NextResponse.json({ markdown });
  }

  return NextResponse.json({ markdown: null });
}
