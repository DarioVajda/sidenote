import fs from 'fs/promises';
import path from 'path';

export function detectAclId(url: string): string | null {
  const match = url.match(/aclanthology\.org\/([A-Za-z0-9][A-Za-z0-9.\-]+[A-Za-z0-9])\/?$/);
  return match ? match[1] : null;
}

function extractMeta(html: string, name: string): string | null {
  const match = html.match(new RegExp(`<meta[^>]+name=["']?${name}["']?[^>]+content=["']([^"']+)["']`, 'i'))
    ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']?${name}["']?`, 'i'));
  return match ? match[1].trim() : null;
}

function extractAllMeta(html: string, name: string): string[] {
  const results: string[] = [];
  const re = new RegExp(`<meta[^>]+name=["']?${name}["']?[^>]+content=["']([^"']+)["']`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) results.push(m[1].trim());
  if (results.length === 0) {
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']?${name}["']?`, 'gi');
    while ((m = re2.exec(html)) !== null) results.push(m[1].trim());
  }
  return results;
}

async function fetchWithRetry(url: string, options?: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw new Error('Unreachable');
}

export async function importFromAcl(id: string): Promise<{
  originalTitle: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  abstract: string | null;
  arxivId: null;
  pdfPath: string;
}> {
  const pageRes = await fetchWithRetry(`https://aclanthology.org/${id}/`);
  if (!pageRes.ok) throw new Error('Failed to fetch ACL Anthology page');
  const html = await pageRes.text();

  const title = extractMeta(html, 'citation_title');
  if (!title) throw new Error('Could not extract paper title from ACL Anthology page');

  const authors = extractAllMeta(html, 'citation_author');

  const dateStr = extractMeta(html, 'citation_publication_date');
  const year = dateStr ? parseInt(dateStr.split('/')[0], 10) : null;

  const venue = extractMeta(html, 'citation_conference_title');

  const abstractMatch = html.match(/class=["']card-body acl-abstract["'][^>]*>.*?<span>([\s\S]*?)<\/span>/i);
  const abstract = abstractMatch ? abstractMatch[1].replace(/<[^>]+>/g, '').trim() : null;

  const pdfUrl = extractMeta(html, 'citation_pdf_url') ?? `https://aclanthology.org/${id}.pdf`;
  const pdfRes = await fetchWithRetry(pdfUrl, { redirect: 'follow' });
  if (!pdfRes.ok) throw new Error('Failed to download PDF from ACL Anthology');

  const pdfDir = path.join(process.cwd(), 'data', 'pdfs');
  await fs.mkdir(pdfDir, { recursive: true });

  const filename = `acl_${id.replace(/[^A-Za-z0-9]/g, '_')}.pdf`;
  const fullPath = path.join(pdfDir, filename);
  const buf = await pdfRes.arrayBuffer();
  await fs.writeFile(fullPath, Buffer.from(buf));

  return {
    originalTitle: title,
    authors,
    year,
    venue,
    abstract,
    arxivId: null,
    pdfPath: `pdfs/${filename}`,
  };
}
