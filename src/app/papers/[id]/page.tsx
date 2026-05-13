'use client';

import { use, useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Paper, PdfRef } from '@/lib/types';
import { generateBibtex } from '@/lib/bibtex';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { githubLight, githubDark } from '@uiw/codemirror-theme-github';
import { EditorView } from '@codemirror/view';
import ChatBox from '@/components/papers/ChatBox';
import QALog from '@/components/papers/QALog';

const PdfViewer = dynamic(() => import('@/components/papers/PdfViewer'), { ssr: false });

type SaveStatus = 'idle' | 'saving' | 'saved';
type PanelOrder = 'pdf-left' | 'notes-left';

type PendingInsert =
  | { mode: 'replace'; from: number; to: number; label: string }
  | { mode: 'placeholder'; from: number }
  | { mode: 'trigger'; from: number; label: string };

function parseRefUri(href: string): PdfRef | null {
  try {
    const params: Record<string, string> = {};
    href.slice(4).split(',').forEach(part => {
      const eq = part.indexOf('=');
      if (eq !== -1) params[part.slice(0, eq)] = part.slice(eq + 1);
    });
    const { page, x1, y1, x2, y2 } = params;
    if (!page || !x1 || !y1 || !x2 || !y2) return null;
    return { page: parseInt(page), x1: parseFloat(x1), y1: parseFloat(y1), x2: parseFloat(x2), y2: parseFloat(y2) };
  } catch { return null; }
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300 dark:border-zinc-600 border-t-gray-500 dark:border-t-zinc-400" />
        Saving…
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      Saved
    </span>
  );
}

function PdfRefIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-middle ml-0.5 shrink-0">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="12" y2="17" />
    </svg>
  );
}

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const check = () => setDark(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export default function PaperDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);

  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [citeCopied, setCiteCopied] = useState(false);
  const [leftPct, setLeftPct] = useState(50);
  const [panelOrder, setPanelOrder] = useState<PanelOrder>('notes-left');
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [dividerDragging, setDividerDragging] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [activeRef, setActiveRef] = useState<PdfRef | null>(null);
  const pendingInsertRef = useRef<PendingInsert | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorViewRef = useRef<any>(null);
  const pendingSelectRef = useRef<{ word: string; line: number | null } | null>(null);

  // Chat / Q&A state
  const [chatOpen, setChatOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [questionSelectionMode, setQuestionSelectionMode] = useState(false);
  const [questionPdfRegion, setQuestionPdfRegion] = useState<PdfRef | null>(null);
  const [questionTextContext, setQuestionTextContext] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const [qaRefreshKey, setQaRefreshKey] = useState(0);

  useEffect(() => { if (questionTextContext) setChatOpen(true); }, [questionTextContext]);

  function handlePromptCopied() {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1800);
  }

  const dark = useDark();

  // Cmd/Ctrl+Enter — switch to preview
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && mode === 'edit') {
        e.preventDefault();
        if (editorViewRef.current) setNotes(editorViewRef.current.state.doc.toString());
        setMode('preview');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mode]);

  // After switching to edit mode, apply any pending word selection from a preview double-click
  useEffect(() => {
    if (mode !== 'edit' || !pendingSelectRef.current) return;
    const { word, line } = pendingSelectRef.current;
    pendingSelectRef.current = null;
    requestAnimationFrame(() => {
      const view = editorViewRef.current;
      if (!view) return;
      const doc = view.state.doc;
      const docStr = doc.toString();
      let pos: number | null = null;
      if (line !== null) {
        try {
          const lineObj = doc.line(line);
          const idx = docStr.indexOf(word, lineObj.from);
          pos = idx !== -1 ? idx : lineObj.from;
        } catch { /* line out of range */ }
      }
      if (pos === null) {
        const idx = docStr.indexOf(word);
        if (idx !== -1) pos = idx;
      }
      if (pos !== null) {
        view.dispatch({
          selection: { anchor: pos, head: pos + word.length },
          effects: EditorView.scrollIntoView(pos, { y: 'center' }),
        });
      }
      view.focus();
    });
  }, [mode]);

  useEffect(() => {
    fetch(`/api/papers/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) { setLoading(false); return; }
        setPaper(data);
        setNotes(data.notes ?? '');
        if (data.notes) setMode('preview');
        setLoading(false);
      });
  }, [id]);

  const triggerSave = useCallback(
    (value: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaveStatus('saving');
        await fetch(`/api/papers/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: value }),
        });
        setSaveStatus('saved');
        savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2000);
      }, 1000);
    },
    [id],
  );

  function onDividerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    isDragging.current = true;
    setDividerDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onDividerPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setLeftPct(Math.max(20, Math.min(80, ((e.clientX - rect.left) / rect.width) * 100)));
  }
  function onDividerPointerUp() {
    isDragging.current = false;
    setDividerDragging(false);
  }

  function handleRefToolbarClick() {
    const view = editorViewRef.current;
    if (!view) return;
    const sel = view.state.selection.main;
    if (sel.from !== sel.to) {
      const label = view.state.sliceDoc(sel.from, sel.to);
      pendingInsertRef.current = { mode: 'replace', from: sel.from, to: sel.to, label };
    } else {
      pendingInsertRef.current = { mode: 'placeholder', from: sel.from };
    }
    setSelectionMode(true);
  }

  function handleRegionSelected(ref: PdfRef) {
    if (questionSelectionMode) {
      setQuestionSelectionMode(false);
      setQuestionPdfRegion(ref);
      return;
    }
    setSelectionMode(false);
    const pending = pendingInsertRef.current;
    pendingInsertRef.current = null;
    const view = editorViewRef.current;
    if (!pending || !view) return;

    const coords = `page=${ref.page},x1=${ref.x1.toFixed(4)},y1=${ref.y1.toFixed(4)},x2=${ref.x2.toFixed(4)},y2=${ref.y2.toFixed(4)}`;

    if (pending.mode === 'replace') {
      view.dispatch({
        changes: { from: pending.from, to: pending.to, insert: `[${pending.label}](ref:${coords})` },
      });
    } else if (pending.mode === 'placeholder') {
      const label = 'Insert text…';
      view.dispatch({
        changes: { from: pending.from, insert: `[${label}](ref:${coords})` },
        selection: { anchor: pending.from + 1, head: pending.from + 1 + label.length },
      });
    } else {
      view.dispatch({ changes: { from: pending.from, insert: `${coords})` } });
    }

    const newValue = view.state.doc.toString();
    setNotes(newValue);
    triggerSave(newValue);
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-zinc-800">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    );
  }
  if (!paper) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-zinc-800">
        <p className="text-gray-500">Paper not found</p>
        <Link href="/" className="text-blue-600 text-sm hover:underline">← Back to list</Link>
      </div>
    );
  }

  const title = paper.originalTitle;
  const isPdfLeft = panelOrder === 'pdf-left';

  const pdfPanel = (
    <PdfViewer
      url={`/api/papers/${id}/pdf`}
      selectionMode={selectionMode || questionSelectionMode}
      onRegionSelected={handleRegionSelected}
      onCancelSelection={() => {
        if (questionSelectionMode) { setQuestionSelectionMode(false); return; }
        setSelectionMode(false);
        pendingInsertRef.current = null;
      }}
      activeRef={activeRef}
    />
  );

  const notesPanel = (
    <div className={`flex flex-col h-full bg-white dark:bg-zinc-800 transition-opacity duration-150 ${selectionMode ? 'opacity-40 pointer-events-none' : ''}`}>
      {/* Notes toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-zinc-800 shrink-0">
        <div className="flex gap-0.5">
          {(['edit', 'preview'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                if (m === 'preview' && editorViewRef.current) {
                  setNotes(editorViewRef.current.state.doc.toString());
                  setQaRefreshKey((k) => k + 1);
                }
                setMode(m);
              }}
              className={`text-xs px-3 py-1.5 rounded-md font-medium capitalize transition-colors ${
                mode === m
                  ? 'bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100'
                  : 'text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
              }`}
            >
              {m === 'edit' ? 'Edit' : 'Preview'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <SaveIndicator status={saveStatus} />
          {mode === 'edit' && (
            <>
            <button
              onClick={() => {
                const view = editorViewRef.current;
                if (!view) return;
                const sel = view.state.selection.main;
                if (sel.from !== sel.to) {
                  setQuestionTextContext(view.state.sliceDoc(sel.from, sel.to));
                }
              }}
              title="Ask about selected text"
              className="flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <line x1="9" y1="10" x2="15" y2="10" /><line x1="12" y1="7" x2="12" y2="13" />
              </svg>
            </button>
            <button
              onClick={handleRefToolbarClick}
              title="Link selected text to a PDF region"
              className="flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M9 13h6M9 17h3" />
              </svg>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </button>
            </>
          )}
        </div>
      </div>

      <div className={`flex-1 min-h-0 ${mode === 'edit' ? 'overflow-hidden' : 'overflow-auto'}`}>
        {mode === 'edit' ? (
          <CodeMirror
            value={notes}
            height="100%"
            editable={!selectionMode}
            onCreateEditor={(view) => { editorViewRef.current = view; }}
            onChange={(value, viewUpdate) => {
              setSaveStatus('idle');
              triggerSave(value);

              if (!selectionMode) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const cursor: number = (viewUpdate as any).state.selection.main.head;
                if (cursor >= 6) {
                  const before = value.slice(0, cursor);
                  const nextChar = value[cursor];
                  if (before.endsWith('](ref:') && (!nextChar || !/[a-zA-Z0-9=]/.test(nextChar))) {
                    const closeIdx = cursor - 6;
                    let openIdx = closeIdx - 1;
                    while (openIdx >= 0 && value[openIdx] !== '[' && value[openIdx] !== '\n') openIdx--;
                    if (openIdx >= 0 && value[openIdx] === '[') {
                      const label = value.slice(openIdx + 1, closeIdx);
                      pendingInsertRef.current = { mode: 'trigger', from: cursor, label };
                      setSelectionMode(true);
                    }
                  }
                }
              }
            }}
            extensions={[markdown({ base: markdownLanguage, codeLanguages: languages }), EditorView.lineWrapping, EditorView.theme({ '.cm-content': { paddingBottom: '50vh' } })]}
            theme={dark ? githubDark : githubLight}
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              highlightActiveLine: true,
              highlightSelectionMatches: false,
              closeBrackets: false,
              autocompletion: false,
            }}
            placeholder="Write notes in markdown…"
            className="h-full text-sm"
          />
        ) : (
          <div
            className="pt-5 px-5 pb-[50vh] prose prose-sm dark:prose-invert max-w-none"
            onContextMenu={(e) => {
              const selected = window.getSelection()?.toString().trim();
              if (!selected) return;
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, text: selected });
            }}
            onDoubleClick={(e) => {
              const word = window.getSelection()?.toString().trim();
              if (!word) return;
              let el = e.target as HTMLElement | null;
              while (el && !el.dataset.sourceLine) el = el.parentElement;
              const line = el?.dataset.sourceLine ? parseInt(el.dataset.sourceLine) : null;
              pendingSelectRef.current = { word, line };
              setMode('edit');
            }}
          >
            {notes ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                urlTransform={(url) => url}
                components={{
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  p({ node, children }: any) { return <p data-source-line={node?.position?.start.line}>{children}</p>; },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  h1({ node, children }: any) { return <h1 data-source-line={node?.position?.start.line}>{children}</h1>; },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  h2({ node, children }: any) { return <h2 data-source-line={node?.position?.start.line}>{children}</h2>; },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  h3({ node, children }: any) { return <h3 data-source-line={node?.position?.start.line}>{children}</h3>; },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  li({ node, children }: any) { return <li data-source-line={node?.position?.start.line}>{children}</li>; },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  blockquote({ node, children }: any) { return <blockquote data-source-line={node?.position?.start.line}>{children}</blockquote>; },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  a({ href, children }: any) {
                    if (href?.startsWith('ref:')) {
                      const ref = parseRefUri(href);
                      if (ref) {
                        return (
                          <button
                            onClick={() => setActiveRef(parseRefUri(href))}
                            className="inline-flex items-baseline gap-0.5 text-blue-600 hover:text-blue-700 underline underline-offset-2 cursor-pointer not-prose font-normal"
                          >
                            {children}
                            <PdfRefIcon />
                          </button>
                        );
                      }
                    }
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {notes}
              </ReactMarkdown>
            ) : (
              <p className="text-gray-400 dark:text-zinc-500 italic not-prose text-sm">No notes yet.</p>
            )}
            {paper && <QALog paperId={paper.id} refreshKey={qaRefreshKey} />}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
    <title>{`Sidenote — ${title}`}</title>
    <div className="flex-1 flex flex-col min-h-0">
      <div className={`border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-6 py-3 shrink-0 transition-opacity duration-150 ${selectionMode ? 'opacity-40' : ''}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link href="/" className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-400 block mb-1">
              ← Papers
            </Link>
            {paper.sourceUrl ? (
              <a href={paper.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-gray-900 dark:text-zinc-100 font-medium leading-snug line-clamp-1 hover:underline hover:text-blue-600 dark:hover:text-blue-400">{title}</a>
            ) : (
              <p className="text-gray-900 dark:text-zinc-100 font-medium leading-snug line-clamp-1">{title}</p>
            )}
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5 truncate">
              {paper.authors.map((author, i) => (
                <span key={author}>
                  {i > 0 && ', '}
                  <a
                    href={`https://scholar.google.com/citations?view_op=search_authors&mauthors=${encodeURIComponent(author)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600 hover:underline"
                  >
                    {author}
                  </a>
                </span>
              ))}
              {paper.year ? ` · ${paper.year}` : ''}
              {paper.venue ? ` · ${paper.venue}` : ''}
            </p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(generateBibtex(paper));
              setCiteCopied(true);
              setTimeout(() => setCiteCopied(false), 1500);
            }}
            title="Copy BibTeX citation"
            className="shrink-0 mt-5 flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
          >
            {citeCopied ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-blue-500">Copied</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2H8.5A2.5 2.5 0 0 0 6 4.5v15A2.5 2.5 0 0 0 8.5 22h7a2.5 2.5 0 0 0 2.5-2.5V7Z" />
                  <path d="M14 2v5h5" />
                  <path d="M9 13h6M9 17h4" />
                  <path d="M3 8h3M3 12h3M3 16h3" />
                </svg>
                Cite
              </>
            )}
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 flex min-h-0 overflow-hidden">
        <div style={{ width: `${leftPct}%` }} className={`min-w-0 overflow-hidden flex flex-col${dividerDragging ? ' pointer-events-none select-none' : ''}`}>
          {isPdfLeft ? pdfPanel : notesPanel}
        </div>

        {/* Divider */}
        <div
          className="relative w-5 shrink-0 cursor-col-resize select-none group/divider"
          onPointerDown={onDividerPointerDown}
          onPointerMove={onDividerPointerMove}
          onPointerUp={onDividerPointerUp}
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-gray-200 dark:bg-zinc-700 group-hover/divider:bg-blue-400 transition-colors" />
          <button
            className="absolute top-4 left-1/2 -translate-x-1/2 z-10 p-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-700 hover:border-gray-300 transition-colors"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setPanelOrder((o) => (o === 'pdf-left' ? 'notes-left' : 'pdf-left'))}
            title="Swap panels"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 dark:text-zinc-400">
              <path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" />
            </svg>
          </button>
          {/* Ask pill */}
          <button
            className="absolute z-20 flex items-center gap-2 px-4 py-2 rounded-full text-white text-xs font-medium whitespace-nowrap cursor-pointer hover:brightness-110"
            style={{
              bottom: 20,
              left: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #a855f7, #ec4899)',
              boxShadow: '0 4px 20px rgba(168,85,247,0.4)',
              opacity: chatOpen ? 0 : 1,
              pointerEvents: chatOpen ? 'none' : 'auto',
              transform: chatOpen ? 'translateX(-50%) scale(0.9)' : 'translateX(-50%)',
              transition: 'opacity 250ms ease, transform 250ms ease',
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setChatOpen(true)}
            title="Ask a question about this paper"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Ask a question…
          </button>
        </div>

        <div className={`flex-1 min-w-0 overflow-hidden flex flex-col${dividerDragging ? ' pointer-events-none select-none' : ''}`}>
          {isPdfLeft ? notesPanel : pdfPanel}
        </div>
      </div>

    </div>

    <ChatBox
      open={chatOpen}
      onClose={() => setChatOpen(false)}
      onCopied={handlePromptCopied}
      paper={paper}
      notes={notes}
      onRequestPdfRegion={() => setQuestionSelectionMode(true)}
      pdfRegion={questionPdfRegion}
      onClearPdfRegion={() => setQuestionPdfRegion(null)}
      textContext={questionTextContext}
      onClearTextContext={() => setQuestionTextContext(null)}
    />

    {/* Copied toast */}
    <div
      className="fixed inset-0 flex items-center justify-center pointer-events-none z-[70] transition-opacity duration-300"
      style={{ opacity: toastVisible ? 1 : 0 }}
    >
      <div className="bg-gray-900/90 dark:bg-white/90 text-white dark:text-gray-900 text-sm px-5 py-2.5 rounded-full shadow-2xl">
        Prompt copied to clipboard
      </div>
    </div>

    {/* Context menu for preview text selection */}
    {contextMenu && (
      <>
        <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
        <div
          className="fixed z-50 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              setQuestionTextContext(contextMenu.text);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors text-left"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Ask about this
          </button>
        </div>
      </>
    )}
    </>
  );
}
