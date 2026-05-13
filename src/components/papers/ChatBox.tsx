'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Paper, PdfRef } from '@/lib/types';

type Target = 'claude-code' | 'external';
type Mode = 'ask' | 'edit';

interface Props {
  open: boolean;
  onClose: () => void;
  onCopied: () => void;
  paper: Paper;
  notes: string;
  onRequestPdfRegion: () => void;
  pdfRegion: PdfRef | null;
  onClearPdfRegion: () => void;
  textContext: string | null;
  onClearTextContext: () => void;
}

export default function ChatBox({
  open, onClose, onCopied,
  paper, notes,
  onRequestPdfRegion,
  pdfRegion, onClearPdfRegion,
  textContext, onClearTextContext,
}: Props) {
  const [target, setTarget] = useState<Target>('claude-code');
  const [mode, setMode] = useState<Mode>('ask');
  const [question, setQuestion] = useState('');
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // double-rAF ensures transition fires after mount
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setVisible(true);
        textareaRef.current?.focus();
      }));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 220);
      return () => clearTimeout(t);
    }
  }, [open]);

  function handleClose() {
    setQuestion('');
    setCopied(false);
    onClearTextContext();
    onClearPdfRegion();
    onClose();
  }

  function buildClaudeCodePrompt() {
    const lines = [`/ask-paper`, `Paper: ${paper.id}`, `Mode: ${mode}`];
    if (textContext) lines.push(`Text context: "${textContext}"`);
    if (pdfRegion) lines.push(`PDF region: page=${pdfRegion.page},x1=${pdfRegion.x1.toFixed(4)},y1=${pdfRegion.y1.toFixed(4)},x2=${pdfRegion.x2.toFixed(4)},y2=${pdfRegion.y2.toFixed(4)}`);
    lines.push(``, question);
    return lines.join('\n');
  }

  function buildExternalPrompt() {
    const lines: string[] = [];
    lines.push(`You are a research assistant helping me understand and analyse academic papers. Answer my questions in depth and with confidence. Cite specific claims by referencing the paper (section, page, or figure number) or, when drawing on external knowledge, name the source. If something is genuinely uncertain, say so — but do not hedge unnecessarily.`);
    lines.push(``, `# Paper Context`);
    lines.push(`**Title:** ${paper.originalTitle}`);
    if (paper.authors.length) lines.push(`**Authors:** ${paper.authors.join(', ')}`);
    if (paper.year) lines.push(`**Year:** ${paper.year}`);
    if (paper.sourceUrl) lines.push(`**Link:** ${paper.sourceUrl}`);
    if (paper.abstract) lines.push(``, `## Abstract`, paper.abstract);
    if (notes) lines.push(``, `## My Notes`, notes);
    if (textContext) lines.push(``, `> ${textContext}`);
    lines.push(``, `## Question`, question);
    return lines.join('\n');
  }

  const canCopy = question.trim().length > 0;

  function handleCopy() {
    if (!canCopy || copied) return;
    const prompt = target === 'claude-code' ? buildClaudeCodePrompt() : buildExternalPrompt();
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    onCopied();
    setTimeout(() => setCopied(false), 2000);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleCopy(); }
  }

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Floating panel */}
      <div
        className="fixed z-50 w-full px-4"
        style={{
          bottom: 24,
          left: '50%',
          maxWidth: 712,
          transform: `translateX(-50%) translateY(${visible ? '0px' : '14px'})`,
          opacity: visible ? 1 : 0,
          transition: 'opacity 200ms ease-out, transform 200ms ease-out',
          pointerEvents: visible ? 'auto' : 'none',
        }}
      >
        {/* Gradient border wrapper */}
        <div className="rounded-2xl p-[1.5px]" style={{ background: 'linear-gradient(135deg, #3b82f6, #a855f7, #ec4899)', boxShadow: '0 0 50px rgba(168,85,247,0.18), 0 20px 40px rgba(0,0,0,0.12)' }}>
        <div className="bg-white dark:bg-zinc-900 rounded-[14px] overflow-hidden">

          {/* Close button */}
          <div className="flex justify-end px-3 pt-2.5">
            <button
              onClick={handleClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
              title="Close"
            >
              <XIcon />
            </button>
          </div>

          {/* Context cards */}
          {textContext && (
            <div className="flex items-start gap-2 border-b border-gray-100 dark:border-zinc-700 px-4 py-2.5 bg-blue-50/60 dark:bg-blue-950/20" style={{ borderLeftWidth: 2, borderLeftColor: 'rgb(96 165 250)' }}>
              <p className="flex-1 text-xs text-gray-600 dark:text-zinc-400 line-clamp-2 leading-relaxed italic">{textContext}</p>
              <button onClick={onClearTextContext} className="shrink-0 mt-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
                <XIcon />
              </button>
            </div>
          )}
          {pdfRegion && (
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-zinc-700 px-4 py-2.5 bg-amber-50/60 dark:bg-amber-950/20" style={{ borderLeftWidth: 2, borderLeftColor: 'rgb(251 191 36)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="flex-1 text-xs text-gray-600 dark:text-zinc-400">Page {pdfRegion.page} — selected region</span>
              <button onClick={onClearPdfRegion} className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
                <XIcon />
              </button>
            </div>
          )}

          {/* Textarea */}
          <div className="px-5 pt-1 pb-1.5">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={mode === 'edit' ? 'Describe what to change in the notes…' : 'Ask a question…'}
              rows={4}
              className="w-full resize-none bg-transparent text-base text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none leading-relaxed"
            />
          </div>

          {/* Bottom bar */}
          <div className="flex items-center gap-2 px-4 pb-4 pt-1 flex-wrap">
            <SegmentedControl
              options={[{ value: 'claude-code', label: 'Claude Code' }, { value: 'external', label: 'External' }]}
              value={target}
              onChange={(v) => setTarget(v as Target)}
            />
            {target === 'claude-code' && (
              <>
                <SegmentedControl
                  options={[{ value: 'ask', label: 'Ask' }, { value: 'edit', label: 'Edit notes' }]}
                  value={mode}
                  onChange={(v) => setMode(v as Mode)}
                />
                <button
                  onClick={onRequestPdfRegion}
                  title="Select a PDF region to reference"
                  className="p-2 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><rect x="8" y="12" width="8" height="6" rx="1" />
                  </svg>
                </button>
              </>
            )}

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs font-mono tracking-tight" style={{ background: 'linear-gradient(90deg,#3b82f6,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>⌘↵</span>
              <button
                onClick={handleCopy}
                disabled={!canCopy}
                className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium overflow-hidden"
                style={{
                  color: canCopy ? 'white' : undefined,
                  cursor: !canCopy ? 'not-allowed' : 'pointer',
                  transition: 'transform 150ms ease',
                  transform: canCopy && !copied ? 'scale(1)' : 'scale(1)',
                }}
              >
                {/* gradient layer */}
                <span
                  className="absolute inset-0 rounded-lg"
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6, #a855f7, #ec4899)',
                    boxShadow: '0 2px 12px rgba(168,85,247,0.35)',
                    opacity: canCopy && !copied ? 1 : 0,
                    transition: 'opacity 400ms ease',
                  }}
                />
                {/* gray layer */}
                <span
                  className="absolute inset-0 rounded-lg bg-gray-100 dark:bg-zinc-700"
                  style={{
                    opacity: !canCopy || copied ? 1 : 0,
                    transition: 'opacity 400ms ease',
                  }}
                />
                <span className="relative flex items-center gap-1.5" style={{ color: !canCopy || copied ? undefined : 'white' }}>
                  {copied ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-zinc-500">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="text-gray-400 dark:text-zinc-500">Copied.</span>
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={canCopy ? 'text-white' : 'text-gray-400 dark:text-zinc-500'}>
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
        </div>
      </div>
    </>,
    document.body,
  );
}

function XIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-zinc-800 rounded-md p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`text-[13px] px-3 py-1.5 rounded font-medium transition-all ${
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
