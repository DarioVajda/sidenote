export type ReadingStatus = 'to_read' | 'reading' | 'done';

export interface PdfRef {
  page: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface Paper {
  id: string;
  folderId: string | null;
  originalTitle: string;
  description: string | null;
  abstract: string | null;
  authors: string[];
  year: number | null;
  venue: string | null;
  sourceUrl: string | null;
  arxivId: string | null;
  pdfPath: string;
  notes: string;
  readingStatus: ReadingStatus;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
