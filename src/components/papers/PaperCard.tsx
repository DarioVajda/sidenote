'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Paper, ReadingStatus } from '@/lib/types';
import { generateBibtex } from '@/lib/bibtex';

const STATUS: Record<ReadingStatus, { label: string; cls: string }> = {
  to_read: { label: 'To read', cls: 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400' },
  reading: { label: 'Reading', cls: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
  done: { label: 'Done', cls: 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' },
};

const STATUS_ORDER: ReadingStatus[] = ['to_read', 'reading', 'done'];

interface Props {
  paper: Paper;
  onStatusChange: (id: string, status: ReadingStatus) => void;
  onDelete: (id: string) => void;
}

export default function PaperCard({ paper, onStatusChange, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(generateBibtex(paper));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const shownAuthors = paper.authors.slice(0, 3);
  const hasMoreAuthors = paper.authors.length > 3;
  const meta = [paper.year, paper.venue].filter(Boolean).join(' · ');
  const { label, cls } = STATUS[paper.readingStatus];
  const addedDate = new Date(paper.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  function cycleStatus(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const idx = STATUS_ORDER.indexOf(paper.readingStatus);
    onStatusChange(paper.id, STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]);
  }

  function handleDeleteClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(true);
  }

  function handleConfirm(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onDelete(paper.id);
  }

  function handleCancel(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(false);
  }

  return (
    <Link href={`/papers/${paper.id}`} className="block">
      <div className="group relative bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all">
        {confirming && (
          <div
            className="absolute inset-0 bg-white/95 dark:bg-zinc-800/95 rounded-lg flex items-center justify-center gap-3 z-10"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <span className="text-sm text-gray-700 dark:text-zinc-300 font-medium">Move to Trash?</span>
            <button
              onClick={handleConfirm}
              className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 transition-colors"
            >
              Move to Trash
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 border border-gray-300 dark:border-zinc-600 text-gray-600 dark:text-zinc-400 text-xs font-medium rounded-md hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-gray-900 dark:text-zinc-100 font-medium text-[15px] leading-snug mb-1 line-clamp-2">
              {paper.originalTitle}
            </h2>
            {shownAuthors.length > 0 && (
              <p className="text-sm text-gray-500 dark:text-zinc-400 truncate mb-0.5">
                {shownAuthors.map((author, i) => (
                  <span key={author}>
                    {i > 0 && ', '}
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(`https://scholar.google.com/citations?view_op=search_authors&mauthors=${encodeURIComponent(author)}`, '_blank'); }}
                      className="hover:text-blue-600 hover:underline"
                    >
                      {author}
                    </button>
                  </span>
                ))}
                {hasMoreAuthors && ' et al.'}
              </p>
            )}
            {meta && <p className="text-xs text-gray-400 dark:text-zinc-500 mb-2">{meta}</p>}
            {paper.description && (
              <p className="text-sm text-gray-600 dark:text-zinc-400 line-clamp-2">{paper.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <button
              onClick={cycleStatus}
              className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${cls}`}
              title="Click to change status"
            >
              {label}
            </button>
            <span className="text-xs text-gray-400 dark:text-zinc-500 whitespace-nowrap">{addedDate}</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
              <button
                onClick={handleCite}
                className="p-1 text-gray-300 dark:text-zinc-500 hover:text-blue-500 transition-colors"
                title="Copy BibTeX citation"
              >
                {copied ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2H8.5A2.5 2.5 0 0 0 6 4.5v15A2.5 2.5 0 0 0 8.5 22h7a2.5 2.5 0 0 0 2.5-2.5V7Z" />
                    <path d="M14 2v5h5" />
                    <path d="M9 13h6M9 17h4" />
                    <path d="M3 8h3M3 12h3M3 16h3" />
                  </svg>
                )}
              </button>
              <button
                onClick={handleDeleteClick}
                className="p-1 -mr-1 text-gray-300 dark:text-zinc-500 hover:text-red-500 transition-colors"
                title="Move to Trash"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
