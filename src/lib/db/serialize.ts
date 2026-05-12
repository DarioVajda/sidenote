import { papers, folders } from './schema';

type DbPaper = typeof papers.$inferSelect;
type DbFolder = typeof folders.$inferSelect;

export function serializePaper(p: DbPaper) {
  return {
    ...p,
    authors: JSON.parse(p.authors || '[]') as string[],
    trashedAt: p.trashedAt instanceof Date
      ? p.trashedAt.toISOString()
      : p.trashedAt != null ? String(p.trashedAt) : null,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt),
  };
}

export function serializeFolder(f: DbFolder) {
  return {
    ...f,
    createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
  };
}
