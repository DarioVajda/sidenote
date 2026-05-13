'use client';

import { useState, useEffect, useCallback } from 'react';

interface Message {
  id: string;
  threadId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface Thread {
  id: string;
  paperId: string;
  createdAt: string;
  messages: Message[];
}

function formatThreadDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}>
      <span className="text-[10px] text-gray-400 dark:text-zinc-500 px-1">
        {isUser ? 'You' : 'Claude'}
      </span>
      <div className={`max-w-[90%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-blue-600 text-white rounded-br-sm'
          : 'bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 rounded-bl-sm'
      }`}>
        {message.content}
      </div>
    </div>
  );
}

function ThreadSection({ thread }: { thread: Thread }) {
  const [open, setOpen] = useState(false);
  const userMessages = thread.messages.filter((m) => m.role === 'user');

  return (
    <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-zinc-500 shrink-0">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">{formatThreadDate(thread.createdAt)}</span>
          <span className="text-xs text-gray-400 dark:text-zinc-500">{userMessages.length} question{userMessages.length !== 1 ? 's' : ''}</span>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`text-gray-400 dark:text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-200 dark:border-zinc-700 px-4 py-3 flex flex-col gap-3">
          {thread.messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function QALog({ paperId, refreshKey }: { paperId: string; refreshKey: number }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/papers/${paperId}/threads`);
      const data = await res.json();
      setThreads(data);
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => { fetchThreads(); }, [fetchThreads, refreshKey]);

  if (threads.length === 0 && !loading) return null;

  return (
    <div className="mt-8 not-prose">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors mb-3"
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span className="font-medium">Q&amp;A Log</span>
        <span className="text-xs text-gray-400 dark:text-zinc-500">{threads.length} session{threads.length !== 1 ? 's' : ''}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-2">
          {threads.map((t) => (
            <ThreadSection key={t.id} thread={t} />
          ))}
        </div>
      )}
    </div>
  );
}
