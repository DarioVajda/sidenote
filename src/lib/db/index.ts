import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import { randomUUID } from "crypto";
import fs from "fs";
import * as schema from "./schema";

const DB_PATH = path.join(process.cwd(), "data", "research.db");
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
export const db = drizzle(sqlite, { schema });

// Run startup tasks after module init (non-blocking)
setImmediate(() => {
  try {
    // 1. Assign all unfoldered, untrashed papers to "old" folder
    const hasUnfiled = sqlite
      .prepare("SELECT 1 FROM papers WHERE folder_id IS NULL AND trashed_at IS NULL LIMIT 1")
      .get();

    if (hasUnfiled) {
      let oldFolder = sqlite
        .prepare("SELECT id FROM folders WHERE name = 'old' AND parent_id IS NULL LIMIT 1")
        .get() as { id: string } | undefined;

      if (!oldFolder) {
        const id = randomUUID();
        sqlite
          .prepare("INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, 'old', NULL, ?)")
          .run(id, Math.floor(Date.now() / 1000));
        oldFolder = { id };
      }
      sqlite
        .prepare("UPDATE papers SET folder_id = ? WHERE folder_id IS NULL AND trashed_at IS NULL")
        .run(oldFolder.id);
    }

    // 2. Purge papers trashed more than 30 days ago
    const cutoff = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const stale = sqlite
      .prepare("SELECT id, pdf_path FROM papers WHERE trashed_at IS NOT NULL AND trashed_at < ?")
      .all(cutoff) as { id: string; pdf_path: string }[];

    for (const p of stale) {
      try {
        fs.unlinkSync(path.join(process.cwd(), "data", p.pdf_path));
      } catch { /* file may already be gone */ }
      sqlite.prepare("DELETE FROM papers WHERE id = ?").run(p.id);
    }
  } catch { /* tables may not exist yet before first drizzle push */ }
});
