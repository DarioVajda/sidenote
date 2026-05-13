import { papers, folders, threads, messages } from './schema';

type DbPaper = typeof papers.$inferSelect;
type DbFolder = typeof folders.$inferSelect;
type DbThread = typeof threads.$inferSelect;
type DbMessage = typeof messages.$inferSelect;

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

export function serializeThread(t: DbThread) {
  return {
    ...t,
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt),
  };
}

export function serializeMessage(m: DbMessage) {
  return {
    ...m,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
  };
}
