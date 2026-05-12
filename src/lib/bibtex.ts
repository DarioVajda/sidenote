import { Paper } from './types';

export function generateBibtex(paper: Paper): string {
  const title = paper.customTitle ?? paper.originalTitle;

  // Citation key: firstAuthorLastName + year + firstSignificantTitleWord
  const firstAuthor = paper.authors[0] ?? '';
  const lastName = (firstAuthor.split(' ').pop() ?? 'unknown')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  const year = paper.year ?? '';
  const STOP_WORDS = new Set(['a', 'an', 'the', 'on', 'in', 'of', 'for', 'and', 'to', 'with', 'via', 'toward', 'towards']);
  const firstWord = title.split(/\s+/)
    .find(w => !STOP_WORDS.has(w.toLowerCase()))
    ?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')
    ?? 'paper';
  const key = `${lastName || 'unknown'}${year}${firstWord}`;

  // Entry type
  let entryType: string;
  let venueField = '';
  if (paper.arxivId) {
    entryType = 'article';
    venueField = `  journal        = {arXiv preprint arXiv:${paper.arxivId}},\n`;
  } else if (paper.venue) {
    entryType = 'inproceedings';
    venueField = `  booktitle      = {${paper.venue}},\n`;
  } else {
    entryType = 'misc';
  }

  const authorStr = paper.authors.join(' and ');

  let bib = `@${entryType}{${key},\n`;
  bib += `  title          = {${title}},\n`;
  if (authorStr) bib += `  author         = {${authorStr}},\n`;
  if (paper.year)  bib += `  year           = {${paper.year}},\n`;
  bib += venueField;
  if (paper.sourceUrl) bib += `  url            = {${paper.sourceUrl}},\n`;
  bib += `}`;

  return bib;
}
