'use client';

import { useState } from 'react';
import { Paper, Folder } from '@/lib/types';

type ModalState = 'url' | 'manual' | 'importing' | 'error';

interface Props {
  onClose: () => void;
  onAdded: (paper: Paper) => void;
  folders: { folder: Folder; depth: number }[];
  defaultFolderId: string | null;
}

const SUPPORTED = ['arXiv', 'OpenReview', 'ACL Anthology', 'PMLR', 'CVF', 'NeurIPS'];

export default function AddPaperModal({ onClose, onAdded, folders, defaultFolderId }: Props) {
  const [state, setState] = useState<ModalState>('url');
  const [url, setUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [folderId, setFolderId] = useState<string>(defaultFolderId ?? '');

  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState('');
  const [venue, setVenue] = useState('');
  const [abstract, setAbstract] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleImport() {
    if (!url.trim()) return;
    setState('importing');
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), folderId: folderId || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Import failed');
      }
      onAdded(await res.json());
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Import failed');
      setState('error');
    }
  }

  async function handleManualSubmit() {
    if (!title.trim() || !pdfFile) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.append('title', title.trim());
    fd.append('authors', authors);
    fd.append('year', year);
    fd.append('venue', venue);
    fd.append('abstract', abstract);
    fd.append('pdf', pdfFile);
    if (folderId) fd.append('folderId', folderId);
    try {
      const res = await fetch('/api/papers/manual', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Failed to add paper');
      onAdded(await res.json());
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add paper');
    } finally {
      setSubmitting(false);
    }
  }

  const FolderPicker = () => (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Folder</label>
      <select
        value={folderId}
        onChange={e => setFolderId(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
      >
        <option value="">(No folder)</option>
        {folders.map(({ folder, depth }) => (
          <option key={folder.id} value={folder.id}>
            {' '.repeat(depth * 3)}{depth > 0 ? '└ ' : ''}{folder.name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Add a paper</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {state === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Paste a URL to import</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                  placeholder="https://arxiv.org/abs/..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
                <p className="mt-1.5 text-xs text-gray-400">Supported: {SUPPORTED.join(', ')}</p>
              </div>
              <FolderPicker />
              <button
                onClick={handleImport}
                disabled={!url.trim()}
                className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Import
              </button>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <button
                onClick={() => setState('manual')}
                className="w-full text-sm text-gray-500 hover:text-gray-800 transition-colors py-1"
              >
                Add manually
              </button>
            </div>
          )}

          {state === 'importing' && (
            <div className="flex flex-col items-center py-10 gap-3">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" />
              <p className="text-sm text-gray-500">Importing paper…</p>
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">{errorMsg}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setState('url')} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  Try again
                </button>
                <button onClick={() => setState('manual')} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  Add manually
                </button>
              </div>
            </div>
          )}

          {state === 'manual' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title <span className="text-red-400">*</span></label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Authors (comma-separated)</label>
                <input type="text" value={authors} onChange={(e) => setAuthors(e.target.value)} placeholder="Jane Smith, John Doe"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                  <input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2024"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Venue</label>
                  <input type="text" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="NeurIPS 2024"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>
              <FolderPicker />
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">PDF <span className="text-red-400">*</span></label>
                <input type="file" accept=".pdf" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Abstract (optional)</label>
                <textarea value={abstract} onChange={(e) => setAbstract(e.target.value)} rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setState('url')} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Back</button>
                <button onClick={handleManualSubmit} disabled={!title.trim() || !pdfFile || submitting}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {submitting ? 'Adding…' : 'Add paper'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
