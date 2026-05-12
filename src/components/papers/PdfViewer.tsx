'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { PdfRef } from '@/lib/types';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.2;

interface Props {
  url: string;
  selectionMode?: boolean;
  onRegionSelected?: (ref: PdfRef) => void;
  onCancelSelection?: () => void;
  activeRef?: PdfRef | null;
}

// Convert two viewport-coordinate points into normalized page coordinates
function screenToPageRef(pagesEl: HTMLDivElement, ax: number, ay: number, bx: number, by: number): PdfRef | null {
  const pages = pagesEl.querySelectorAll('.react-pdf__Page');
  const cy = (ay + by) / 2;
  for (let i = 0; i < pages.length; i++) {
    const r = (pages[i] as HTMLElement).getBoundingClientRect();
    if (cy >= r.top && cy <= r.bottom) {
      return {
        page: i + 1,
        x1: Math.max(0, Math.min(1, (Math.min(ax, bx) - r.left) / r.width)),
        y1: Math.max(0, Math.min(1, (Math.min(ay, by) - r.top) / r.height)),
        x2: Math.max(0, Math.min(1, (Math.max(ax, bx) - r.left) / r.width)),
        y2: Math.max(0, Math.min(1, (Math.max(ay, by) - r.top) / r.height)),
      };
    }
  }
  return null;
}

export default function PdfViewer({ url, selectionMode, onRegionSelected, onCancelSelection, activeRef }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [displayZoom, setDisplayZoom] = useState(100);
  const [containerWidth, setContainerWidth] = useState(0);
  const [basePageWidth, setBasePageWidth] = useState(0);
  const [selDrag, setSelDrag] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);
  const [highlightRect, setHighlightRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [highlightOpacity, setHighlightOpacity] = useState(1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1.0);
  const liveScaleRef = useRef(1.0);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureActiveRef = useRef(false);
  const cursorRef = useRef({ x: 0, y: 0 });
  const scrollStartRef = useRef({ x: 0, y: 0 });
  const pendingScrollRef = useRef<{ x: number; y: number } | null>(null);
  const containerWidthRef = useRef(0);
  const basePageWidthRef = useRef(0);
  const centerPadStartRef = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let initialised = false;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      containerWidthRef.current = w;
      setContainerWidth(w);
      if (!initialised) {
        initialised = true;
        const bw = w - 24;
        basePageWidthRef.current = bw;
        setBasePageWidth(bw);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending || !scrollRef.current) return;
    pendingScrollRef.current = null;
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = pending.x;
        scrollRef.current.scrollTop = pending.y;
      }
    });
  }, [zoom]);

  const initGesture = useCallback((clientX: number, clientY: number) => {
    const scrollEl = scrollRef.current;
    const pagesEl = pagesRef.current;
    if (!scrollEl || !pagesEl) return;
    gestureActiveRef.current = true;
    const rect = scrollEl.getBoundingClientRect();
    const vx = clientX - rect.left;
    const vy = clientY - rect.top;
    cursorRef.current = { x: vx, y: vy };
    scrollStartRef.current = { x: scrollEl.scrollLeft, y: scrollEl.scrollTop };
    const cw = containerWidthRef.current;
    const pw = basePageWidthRef.current * zoomRef.current;
    centerPadStartRef.current = Math.max(0, (cw - pw) / 2);
    pagesEl.style.transformOrigin = `${vx + scrollEl.scrollLeft}px ${vy + scrollEl.scrollTop}px`;
  }, []);

  const applyLiveScale = useCallback((newScale: number) => {
    liveScaleRef.current = newScale;
    if (pagesRef.current) {
      pagesRef.current.style.transform = newScale === 1 ? '' : `scale(${newScale})`;
    }
    setDisplayZoom(Math.round(zoomRef.current * newScale * 100));
  }, []);

  const commitScale = useCallback(() => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      gestureActiveRef.current = false;
      const scale = liveScaleRef.current;
      const oldZoom = zoomRef.current;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * scale));
      const factor = newZoom / oldZoom;
      const { x: vx, y: vy } = cursorRef.current;
      const { x: sx, y: sy } = scrollStartRef.current;
      const oldCenterPad = centerPadStartRef.current;
      const cw = containerWidthRef.current;
      const newCenterPad = Math.max(0, (cw - basePageWidthRef.current * newZoom) / 2);
      pendingScrollRef.current = {
        x: Math.max(0, newCenterPad - vx + factor * (vx + sx - oldCenterPad)),
        y: (sy + vy) * factor - vy,
      };
      liveScaleRef.current = 1.0;
      if (pagesRef.current) {
        pagesRef.current.style.transform = '';
        pagesRef.current.style.transformOrigin = '';
      }
      zoomRef.current = newZoom;
      setZoom(newZoom);
      setDisplayZoom(Math.round(newZoom * 100));
    }, 120);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (!gestureActiveRef.current) initGesture(e.clientX, e.clientY);
      applyLiveScale(liveScaleRef.current * Math.exp(-e.deltaY * 0.02));
      commitScale();
    };
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      if (commitTimer.current) clearTimeout(commitTimer.current);
      liveScaleRef.current = 1.0;
      if (pagesRef.current) pagesRef.current.style.transform = '';
      const ge = e as unknown as { clientX: number; clientY: number };
      initGesture(ge.clientX, ge.clientY);
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      applyLiveScale((e as unknown as { scale: number }).scale);
    };
    const onGestureEnd = (e: Event) => { e.preventDefault(); commitScale(); };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart, { passive: false });
    el.addEventListener('gesturechange', onGestureChange, { passive: false });
    el.addEventListener('gestureend', onGestureEnd, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureEnd);
    };
  }, [initGesture, applyLiveScale, commitScale]);

  const zoomTo = useCallback((newZoom: number) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    if (commitTimer.current) clearTimeout(commitTimer.current);
    liveScaleRef.current = 1.0;
    gestureActiveRef.current = false;
    if (pagesRef.current) {
      pagesRef.current.style.transform = '';
      pagesRef.current.style.transformOrigin = '';
    }
    zoomRef.current = clamped;
    setZoom(clamped);
    setDisplayZoom(Math.round(clamped * 100));
  }, []);

  // Draw highlight when activeRef changes
  useEffect(() => {
    if (!activeRef || !pagesRef.current || !scrollRef.current) {
      setHighlightRect(null);
      return;
    }
    const pages = pagesRef.current.querySelectorAll('.react-pdf__Page');
    const pageEl = pages[activeRef.page - 1] as HTMLElement | undefined;
    if (!pageEl) return;

    const pagesRect = pagesRef.current.getBoundingClientRect();
    const pageRect = pageEl.getBoundingClientRect();

    setHighlightRect({
      top: pageRect.top - pagesRect.top + activeRef.y1 * pageRect.height,
      left: pageRect.left - pagesRect.left + activeRef.x1 * pageRect.width,
      width: (activeRef.x2 - activeRef.x1) * pageRect.width,
      height: (activeRef.y2 - activeRef.y1) * pageRect.height,
    });
    setHighlightOpacity(1);

    // Scroll so the referenced region is near the top
    const scrollEl = scrollRef.current;
    const scrollRect = scrollEl.getBoundingClientRect();
    const targetScrollTop = pageRect.top - scrollRect.top + scrollEl.scrollTop + activeRef.y1 * pageRect.height - 80;
    scrollEl.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });

    const t1 = setTimeout(() => setHighlightOpacity(0), 1500);
    const t2 = setTimeout(() => setHighlightRect(null), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [activeRef]);

  // Escape cancels selection
  useEffect(() => {
    if (!selectionMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelDrag(null); onCancelSelection?.(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectionMode, onCancelSelection]);

  function onOverlayMouseDown(e: React.MouseEvent) {
    setSelDrag({ startX: e.clientX, startY: e.clientY, curX: e.clientX, curY: e.clientY });
    e.preventDefault();
  }

  function onOverlayMouseMove(e: React.MouseEvent) {
    setSelDrag(prev => prev ? { ...prev, curX: e.clientX, curY: e.clientY } : null);
  }

  function onOverlayMouseUp(e: React.MouseEvent) {
    if (!selDrag) return;
    if (pagesRef.current && onRegionSelected) {
      const ref = screenToPageRef(pagesRef.current, selDrag.startX, selDrag.startY, e.clientX, e.clientY);
      if (ref) onRegionSelected(ref);
    }
    setSelDrag(null);
  }

  const pageWidth = basePageWidth > 0 ? basePageWidth * zoom : undefined;
  const centerPad = pageWidth != null ? Math.max(0, (containerWidth - pageWidth) / 2) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-1 px-3 py-1.5 border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shrink-0">
        <button onClick={() => zoomTo(zoomRef.current - ZOOM_STEP)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-600 dark:text-zinc-400 text-sm font-medium" title="Zoom out">−</button>
        <span className="text-xs text-gray-500 dark:text-zinc-400 w-10 text-center tabular-nums">{displayZoom}%</span>
        <button onClick={() => zoomTo(zoomRef.current + ZOOM_STEP)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-600 dark:text-zinc-400 text-sm font-medium" title="Zoom in">+</button>
        <button onClick={() => zoomTo(1)} className="ml-1 text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 px-1.5 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-700" title="Reset zoom">Reset</button>
      </div>

      {/* Instruction banner shown during selection */}
      {selectionMode && (
        <div className="shrink-0 bg-blue-50 dark:bg-blue-950/50 border-b border-blue-200 dark:border-blue-900 px-4 py-2 text-xs text-blue-700 dark:text-blue-400 flex items-center justify-between">
          <span>Draw a rectangle over the region you want to reference</span>
          <span className="text-blue-400 dark:text-blue-500 font-medium">Esc to cancel</span>
        </div>
      )}

      {/* Scroll area — bg-gray-100 kept as-is so PDFs render on a neutral background */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto bg-gray-100 dark:bg-zinc-800">
        {/* Fixed overlay for capturing mouse events during selection */}
        {selectionMode && (
          <div
            className="fixed inset-0 z-30"
            style={{ cursor: 'crosshair' }}
            onMouseDown={onOverlayMouseDown}
            onMouseMove={onOverlayMouseMove}
            onMouseUp={onOverlayMouseUp}
          />
        )}

        {/* Rubber-band rectangle */}
        {selDrag && (
          <div
            className="fixed pointer-events-none rounded border-2 border-blue-500 bg-blue-500/10"
            style={{
              zIndex: 31,
              left: Math.min(selDrag.startX, selDrag.curX),
              top: Math.min(selDrag.startY, selDrag.curY),
              width: Math.abs(selDrag.curX - selDrag.startX),
              height: Math.abs(selDrag.curY - selDrag.startY),
            }}
          />
        )}

        <Document
          file={url}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={
            <div className="flex items-center justify-center h-32 mt-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          }
          error={
            <div className="flex items-center justify-center h-32 mt-8 text-sm text-gray-500 dark:text-zinc-400">
              Failed to load PDF.
            </div>
          }
        >
          <div
            ref={pagesRef}
            style={{ paddingLeft: centerPad, position: 'relative' }}
            className="flex flex-col items-start gap-3 py-4"
          >
            {Array.from({ length: numPages }, (_, i) => (
              <Page key={i + 1} pageNumber={i + 1} width={pageWidth} renderTextLayer renderAnnotationLayer />
            ))}

            {/* Highlight overlay */}
            {highlightRect && (
              <div
                className="absolute pointer-events-none rounded-sm"
                style={{
                  top: highlightRect.top,
                  left: highlightRect.left,
                  width: highlightRect.width,
                  height: highlightRect.height,
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  border: '2px solid rgba(59, 130, 246, 0.7)',
                  opacity: highlightOpacity,
                  transition: 'opacity 0.7s ease',
                  zIndex: 10,
                }}
              />
            )}
          </div>
        </Document>
      </div>
    </div>
  );
}
