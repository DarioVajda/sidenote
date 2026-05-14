'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  folderId: string;
}

export default function ProjectSummary({ folderId }: Props) {
  const [markdown, setMarkdown] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setMarkdown(undefined);
    fetch(`/api/folders/${folderId}/summary`)
      .then(r => r.json())
      .then(data => setMarkdown(data.markdown ?? null));
  }, [folderId]);

  return (
    <div className="
      w-full lg:w-[450px] shrink-0
      border-t border-gray-200 dark:border-zinc-800
      lg:border-t-0 lg:border-r lg:border-gray-200 lg:dark:border-zinc-800
      lg:h-full overflow-y-auto
      px-5 py-6
    ">
      {markdown === undefined ? (
        <div className="animate-pulse space-y-3 pt-2">
          <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-2/3" />
          <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-full" />
          <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-5/6" />
          <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-full" />
        </div>
      ) : markdown === null ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[120px] text-center px-2">
          <p className="text-sm text-gray-400 dark:text-zinc-500 mb-1">No project summary yet.</p>
          <p className="text-xs text-gray-300 dark:text-zinc-600 font-mono">Run /before-research to generate one.</p>
        </div>
      ) : (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {markdown}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
