'use client';

import { Paper } from '@/lib/types';

interface Props {
  papers: Paper[];
  onRestore: (id: string) => void;
  onDeletePermanent: (id: string) => void;
  onEmptyTrash: () => void;
}

function daysRemaining(trashedAt: string): number {
  const trashed = new Date(trashedAt).getTime();
  const purgeAt = trashed + 30 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((purgeAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default function TrashView({ papers, onRestore, onDeletePermanent, onEmptyTrash }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">Trash</h1>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Items are permanently deleted after 30 days</p>
        </div>
        {papers.length > 0 && (
          <button
            onClick={onEmptyTrash}
            className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 border border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            Empty Trash
          </button>
        )}
      </div>

      {papers.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 dark:text-zinc-500 text-sm">Trash is empty</p>
        </div>
      ) : (
        <div className="space-y-2">
          {papers.map(paper => {
            const days = paper.trashedAt ? daysRemaining(paper.trashedAt) : 0;
            return (
              <div key={paper.id} className="flex items-center gap-4 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 truncate">{paper.originalTitle}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                    {paper.trashedAt
                      ? `Trashed ${new Date(paper.trashedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                      : ''}
                    {' · '}
                    <span className={days <= 3 ? 'text-red-500 dark:text-red-400' : ''}>
                      {days === 0 ? 'Deletes today' : `${days} day${days === 1 ? '' : 's'} left`}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onRestore(paper.id)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 border border-blue-200 dark:border-blue-800 hover:border-blue-300 px-2.5 py-1 rounded transition-colors"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => onDeletePermanent(paper.id)}
                    className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 border border-red-200 dark:border-red-800 hover:border-red-300 px-2.5 py-1 rounded transition-colors"
                  >
                    Delete permanently
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
