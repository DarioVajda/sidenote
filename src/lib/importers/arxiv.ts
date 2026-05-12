import fs from 'fs/promises';
import path from 'path';

export function detectArxivId(url: string): string | null {
  const match = url.match(/arxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)/i);
  return match ? match[1] : null;
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

export async function importFromArxiv(url: string, id: string): Promise<{
  originalTitle: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  abstract: string | null;
  arxivId: string;
  pdfPath: string;
}> {
  const cleanId = id.replace(/v\d+$/, '');

  let xml = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 3000 * attempt));
    const apiRes = await fetch(`https://export.arxiv.org/api/query?id_list=${cleanId}`);
    if (apiRes.status === 429) {
      if (attempt === 3) throw new Error('arXiv is rate-limiting requests right now. Please wait a minute and try again.');
      continue;
    }
    if (!apiRes.ok) throw new Error('Failed to fetch arXiv metadata');
    xml = await apiRes.text();
    break;
  }

  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
  if (!entryMatch) throw new Error('Paper not found on arXiv');
  const entry = entryMatch[1];

  const title = extractTag(entry, 'title').replace(/\s+/g, ' ');
  if (!title) throw new Error('Could not extract paper title');

  const summary = extractTag(entry, 'summary').replace(/\s+/g, ' ');
  const published = extractTag(entry, 'published');
  const year = published ? new Date(published).getFullYear() : null;

  const journalMatch = entry.match(/arxiv:journal_ref[^>]*>([\s\S]*?)<\/arxiv:journal_ref/i);
  const venue = journalMatch ? journalMatch[1].trim() : null;

  const authorBlocks = [...entry.matchAll(/<author>([\s\S]*?)<\/author>/gi)];
  const authors = authorBlocks
    .map(block => {
      const nameMatch = block[1].match(/<name>([\s\S]*?)<\/name>/i);
      return nameMatch ? nameMatch[1].trim() : '';
    })
    .filter(Boolean);

  const pdfUrl = `https://arxiv.org/pdf/${cleanId}.pdf`;
  const pdfRes = await fetch(pdfUrl, { redirect: 'follow' });
  if (!pdfRes.ok) throw new Error('Failed to download PDF from arXiv');

  const pdfDir = path.join(process.cwd(), 'data', 'pdfs');
  await fs.mkdir(pdfDir, { recursive: true });

  const filename = `${cleanId.replace('/', '_')}.pdf`;
  const fullPath = path.join(pdfDir, filename);
  const buf = await pdfRes.arrayBuffer();
  await fs.writeFile(fullPath, Buffer.from(buf));

  return {
    originalTitle: title,
    authors,
    year,
    venue,
    abstract: summary || null,
    arxivId: cleanId,
    pdfPath: `pdfs/${filename}`,
  };
}
