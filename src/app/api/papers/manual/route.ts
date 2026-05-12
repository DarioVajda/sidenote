import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { papers } from '@/lib/db/schema';
import { randomUUID } from 'crypto';
import { serializePaper } from '@/lib/db/serialize';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const authorsStr = (formData.get('authors') as string) || '';
    const yearStr = (formData.get('year') as string) || '';
    const venue = (formData.get('venue') as string) || '';
    const abstract = (formData.get('abstract') as string) || '';
    const folderId = (formData.get('folderId') as string) || null;
    const pdfFile = formData.get('pdf') as File | null;

    if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    if (!pdfFile) return NextResponse.json({ error: 'PDF is required' }, { status: 400 });

    const id = randomUUID();
    const pdfDir = path.join(process.cwd(), 'data', 'pdfs');
    await fs.mkdir(pdfDir, { recursive: true });
    const filename = `manual_${id}.pdf`;
    await fs.writeFile(path.join(pdfDir, filename), Buffer.from(await pdfFile.arrayBuffer()));

    const authors = authorsStr
      ? authorsStr.split(',').map((a) => a.trim()).filter(Boolean)
      : [];
    const year = yearStr ? parseInt(yearStr, 10) : null;
    const now = new Date();

    const [paper] = await db.insert(papers).values({
      id,
      folderId: folderId || null,
      originalTitle: title.trim(),
      customTitle: null,
      description: null,
      abstract: abstract || null,
      authors: JSON.stringify(authors),
      year: year && !isNaN(year) ? year : null,
      venue: venue || null,
      sourceUrl: null,
      arxivId: null,
      pdfPath: `pdfs/${filename}`,
      notes: '',
      readingStatus: 'to_read',
      createdAt: now,
      updatedAt: now,
    }).returning();

    return NextResponse.json(serializePaper(paper), { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to add paper' }, { status: 500 });
  }
}
