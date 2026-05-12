import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { papers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [paper] = await db.select().from(papers).where(eq(papers.id, id));
  if (!paper) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const buf = await fs.readFile(path.join(process.cwd(), 'data', paper.pdfPath));
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${id}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'PDF file not found' }, { status: 404 });
  }
}
