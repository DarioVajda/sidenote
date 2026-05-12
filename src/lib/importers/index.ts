import { detectArxivId, importFromArxiv } from './arxiv';
import { detectAclId, importFromAcl } from './acl';

export interface ImportResult {
  originalTitle: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  abstract: string | null;
  sourceUrl: string;
  arxivId: string | null;
  pdfPath: string;
}

export async function importFromUrl(url: string): Promise<ImportResult> {
  const arxivId = detectArxivId(url);
  if (arxivId) {
    const result = await importFromArxiv(url, arxivId);
    return { ...result, sourceUrl: url };
  }

  const aclId = detectAclId(url);
  if (aclId) {
    const result = await importFromAcl(aclId);
    return { ...result, sourceUrl: url };
  }

  throw new Error(
    'Unsupported source. Paste a URL from arXiv, OpenReview, ACL Anthology, PMLR, CVF, or NeurIPS proceedings.'
  );
}
