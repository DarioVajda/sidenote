'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Paper, PdfRef } from '@/lib/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface Thread {
  id: string;
  createdAt: string;
  messages: Message[];
}

type Target = 'claude-code' | 'external';
type Mode = 'ask' | 'edit';

interface Props {
  paper: Paper;
  notes: string;
  column: 'left' | 'right';
  collapsed: boolean;
  onToggleCollapse: () => void;
  onMoveColumn: () => void;
  onRequestPdfRegion: () => void;
  pdfRegion: PdfRef | null;
  onClearPdfRegion: () => void;
  textContext: string | null;
  onClearTextContext: () => void;
  onCopied: () => void;
  refreshKey: number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}>
      <span className="text-[10px] text-gray-400 dark:text-zinc-500 px-1">{isUser ? 'You' : 'Claude'}</span>
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
  const userCount = thread.messages.filter(m => m.role === 'user').length;
  return (
    <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-zinc-500 shrink-0">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">{formatDate(thread.createdAt)}</span>
          <span className="text-xs text-gray-400 dark:text-zinc-500">{userCount}Q</span>
        </div>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`text-gray-400 dark:text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-gray-200 dark:border-zinc-700 px-3 py-2.5 flex flex-col gap-2.5">
          {thread.messages.map(m => <MessageBubble key={m.id} message={m} />)}
        </div>
      )}
    </div>
  );
}

function SegmentedControl({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-zinc-800 rounded-md p-0.5">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`text-[12px] px-2.5 py-1 rounded font-medium transition-all ${
            value === o.value
              ? 'text-white shadow-sm'
              : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
          }`}
          style={value === o.value ? { background: 'linear-gradient(135deg, #3b82f6, #a855f7)' } : {}}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function XIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function QAPanel({
  paper, notes,
  column,
  collapsed, onToggleCollapse, onMoveColumn,
  onRequestPdfRegion,
  pdfRegion, onClearPdfRegion,
  textContext, onClearTextContext,
  onCopied, refreshKey,
}: Props) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [target, setTarget] = useState<Target>('claude-code');
  const [mode, setMode] = useState<Mode>('ask');
  const [question, setQuestion] = useState('');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Expand and focus when text context arrives from outside
  useEffect(() => {
    if (textContext && collapsed) onToggleCollapse();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textContext]);

  // Focus compose textarea when panel expands
  useEffect(() => {
    if (!collapsed) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [collapsed]);

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch(`/api/papers/${paper.id}/threads`);
      setThreads(await res.json());
    } catch { /* ignore */ }
  }, [paper.id]);

  useEffect(() => { fetchThreads(); }, [fetchThreads, refreshKey]);

  function buildClaudeCodePrompt() {
    const lines = ['/ask-paper', `Paper: ${paper.id}`, `Mode: ${mode}`];
    if (textContext) lines.push(`Text context: "${textContext}"`);
    if (pdfRegion) lines.push(`PDF region: page=${pdfRegion.page},x1=${pdfRegion.x1.toFixed(4)},y1=${pdfRegion.y1.toFixed(4)},x2=${pdfRegion.x2.toFixed(4)},y2=${pdfRegion.y2.toFixed(4)}`);
    lines.push('', question);
    return lines.join('\n');
  }

  function buildExternalPrompt() {
    const lines: string[] = [
      'You are a research assistant helping me understand and analyse academic papers. Answer my questions in depth and with confidence. Cite specific claims by referencing the paper (section, page, or figure number) or, when drawing on external knowledge, name the source. If something is genuinely uncertain, say so — but do not hedge unnecessarily.',
      '', '# Paper Context',
      `**Title:** ${paper.originalTitle}`,
    ];
    if (paper.authors.length) lines.push(`**Authors:** ${paper.authors.join(', ')}`);
    if (paper.year) lines.push(`**Year:** ${paper.year}`);
    if (paper.sourceUrl) lines.push(`**Link:** ${paper.sourceUrl}`);
    if (paper.abstract) lines.push('', '## Abstract', paper.abstract);
    if (notes) lines.push('', '## My Notes', notes);
    if (textContext) lines.push('', `> ${textContext}`);
    lines.push('', '## Question', question);
    return lines.join('\n');
  }

  const canCopy = question.trim().length > 0;

  function handleCopy() {
    if (!canCopy || copied) return;
    navigator.clipboard.writeText(target === 'claude-code' ? buildClaudeCodePrompt() : buildExternalPrompt());
    setCopied(true);
    onCopied();
    setTimeout(() => setCopied(false), 2000);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleCopy(); }
  }

  const hasThreads = threads.length > 0;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-800">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-12 shrink-0 border-b border-gray-200 dark:border-zinc-700 ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-zinc-500 shrink-0">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">Q&amp;A</span>
        {hasThreads && (
          <span className="text-xs text-gray-400 dark:text-zinc-500">
            {threads.length} session{threads.length !== 1 ? 's' : ''}
          </span>
        )}

        {/* Ask pill — only shown when collapsed, centered in remaining space */}
        <div className="flex-1 flex justify-center">
          {collapsed && (
            <button
              onClick={onToggleCollapse}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-white text-xs font-medium whitespace-nowrap hover:brightness-110 transition-all"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #a855f7, #ec4899)', boxShadow: '0 2px 12px rgba(168,85,247,0.35)' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Ask a question…
            </button>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={onMoveColumn}
            title={column === 'left' ? 'Move to right column' : 'Move to left column'}
            className="p-1.5 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded transition-colors"
          >
            {column === 'left' ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            )}
          </button>
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand Q&A' : 'Collapse Q&A'}
            className="p-1.5 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Thread history — scrolls independently, block layout so items never compress */}
          {hasThreads && (
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5 space-y-2">
              {threads.map(t => <ThreadSection key={t.id} thread={t} />)}
            </div>
          )}

          {/* Compose — pinned at bottom, never scrolls away */}
          <div className={`shrink-0 ${hasThreads ? 'border-t border-gray-100 dark:border-zinc-800' : 'flex-1 flex flex-col'}`}>
            {textContext && (
              <div
                className="flex items-start gap-2 px-3 py-2 bg-blue-50/60 dark:bg-blue-950/20 border-b border-gray-100 dark:border-zinc-800"
                style={{ borderLeftWidth: 2, borderLeftColor: 'rgb(96 165 250)' }}
              >
                <p className="flex-1 text-xs text-gray-600 dark:text-zinc-400 line-clamp-2 leading-relaxed italic">{textContext}</p>
                <button onClick={onClearTextContext} className="shrink-0 mt-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
                  <XIcon />
                </button>
              </div>
            )}
            {pdfRegion && (
              <div
                className="flex items-center gap-2 px-3 py-2 bg-amber-50/60 dark:bg-amber-950/20 border-b border-gray-100 dark:border-zinc-800"
                style={{ borderLeftWidth: 2, borderLeftColor: 'rgb(251 191 36)' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="flex-1 text-xs text-gray-600 dark:text-zinc-400">Page {pdfRegion.page} — selected region</span>
                <button onClick={onClearPdfRegion} className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
                  <XIcon />
                </button>
              </div>
            )}

            <div className="px-3 pt-2 flex-1">
              <textarea
                ref={textareaRef}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={mode === 'edit' ? 'Describe what to change in the notes…' : 'Ask a question…'}
                rows={3}
                className="w-full resize-none bg-transparent text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none leading-relaxed"
              />
            </div>

            <div className="flex items-center gap-1.5 px-3 pb-3 pt-1 flex-wrap">
              <SegmentedControl
                options={[{ value: 'claude-code', label: 'Claude Code' }, { value: 'external', label: 'External' }]}
                value={target}
                onChange={v => setTarget(v as Target)}
              />
              {target === 'claude-code' && (
                <>
                  <SegmentedControl
                    options={[{ value: 'ask', label: 'Ask' }, { value: 'edit', label: 'Edit notes' }]}
                    value={mode}
                    onChange={v => setMode(v as Mode)}
                  />
                  <button
                    onClick={onRequestPdfRegion}
                    title="Select a PDF region to reference"
                    className="p-1.5 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><rect x="8" y="12" width="8" height="6" rx="1" />
                    </svg>
                  </button>
                </>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-xs font-mono tracking-tight" style={{ background: 'linear-gradient(90deg,#3b82f6,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>⌘↵</span>
                <button
                  onClick={handleCopy}
                  disabled={!canCopy}
                  className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium overflow-hidden"
                  style={{ cursor: !canCopy ? 'not-allowed' : 'pointer' }}
                >
                  <span className="absolute inset-0 rounded-lg" style={{ background: 'linear-gradient(135deg, #3b82f6, #a855f7, #ec4899)', boxShadow: '0 2px 12px rgba(168,85,247,0.35)', opacity: canCopy && !copied ? 1 : 0, transition: 'opacity 400ms ease' }} />
                  <span className="absolute inset-0 rounded-lg bg-gray-100 dark:bg-zinc-700" style={{ opacity: !canCopy || copied ? 1 : 0, transition: 'opacity 400ms ease' }} />
                  <span className="relative flex items-center gap-1.5">
                    {copied ? (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-zinc-500"><polyline points="20 6 9 17 4 12" /></svg>
                        <span className="text-gray-400 dark:text-zinc-500">Copied.</span>
                      </>
                    ) : (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={canCopy ? 'text-white' : 'text-gray-400 dark:text-zinc-500'}>
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        <span className={canCopy ? 'text-white' : 'text-gray-400 dark:text-zinc-500'}>Copy prompt</span>
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
