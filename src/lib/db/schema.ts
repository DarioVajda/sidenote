import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

export const folders = sqliteTable("folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  parentId: text("parent_id").references((): AnySQLiteColumn => folders.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const papers = sqliteTable("papers", {
  id: text("id").primaryKey(),
  folderId: text("folder_id").references(() => folders.id, { onDelete: "set null" }),
  originalTitle: text("original_title").notNull(),
  customTitle: text("custom_title"),
  description: text("description"),
  abstract: text("abstract"),
  authors: text("authors").notNull().default("[]"),
  year: integer("year"),
  venue: text("venue"),
  sourceUrl: text("source_url"),
  arxivId: text("arxiv_id"),
  pdfPath: text("pdf_path").notNull(),
  notes: text("notes").notNull().default(""),
  readingStatus: text("reading_status", {
    enum: ["to_read", "reading", "done"],
  }).notNull().default("to_read"),
  trashedAt: integer("trashed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const pdfReferences = sqliteTable("pdf_references", {
  id: text("id").primaryKey(),
  paperId: text("paper_id").notNull().references(() => papers.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  page: integer("page").notNull(),
  x1: real("x1").notNull(),
  y1: real("y1").notNull(),
  x2: real("x2").notNull(),
  y2: real("y2").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
