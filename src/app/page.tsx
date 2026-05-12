'use client';

import { useState, useEffect, useMemo } from 'react';
import { Paper, Folder, ReadingStatus } from '@/lib/types';
import PaperCard from '@/components/papers/PaperCard';
import AddPaperModal from '@/components/papers/AddPaperModal';
import FolderSidebar from '@/components/folders/FolderSidebar';
import TrashView from '@/components/papers/TrashView';

function getDescendantIds(folders: Folder[], rootId: string): string[] {
  const result: string[] = [rootId];
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    folders.filter(f => f.parentId === current).forEach(f => {
      result.push(f.id);
      queue.push(f.id);
    });
  }
  return result;
}

function flattenFolders(folders: Folder[], parentId: string | null = null, depth = 0): { folder: Folder; depth: number }[] {
  return folders
    .filter(f => f.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap(f => [{ folder: f, depth }, ...flattenFolders(folders, f.id, depth + 1)]);
}

export default function HomePage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [trashedPapers, setTrashedPapers] = useState<Paper[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedView, setSelectedView] = useState<string>('all');

  useEffect(() => {
    Promise.all([
      fetch('/api/papers').then(r => r.json()),
      fetch('/api/folders').then(r => r.json()),
      fetch('/api/papers/trash').then(r => r.json()),
    ]).then(([p, f, t]) => {
      setPapers(p);
      setFolders(f);
      setTrashedPapers(t);
      setLoading(false);
    });
  }, []);

  // Papers visible in the current view
  const visiblePapers = useMemo(() => {
    if (selectedView === 'all') return papers;
    if (selectedView === 'trash') return [];
    const ids = getDescendantIds(folders, selectedView);
    return papers.filter(p => p.folderId !== null && ids.includes(p.folderId));
  }, [papers, folders, selectedView]);

  const defaultFolderId = useMemo(() => {
    if (selectedView === 'all' || selectedView === 'trash') return null;
    return selectedView;
  }, [selectedView]);

  // ── Folder handlers ────────────────────────────────────────────────
  async function handleCreateFolder(name: string, parentId: string | null): Promise<Folder> {
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId }),
    });
    const folder: Folder = await res.json();
    setFolders(prev => [...prev, folder]);
    return folder;
  }

  async function handleRenameFolder(id: string, name: string) {
    await fetch(`/api/folders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
  }

  async function handleDeleteFolder(id: string) {
    await fetch(`/api/folders/${id}`, { method: 'DELETE' });
    setFolders(prev => prev.filter(f => f.id !== id));
    // Papers in this folder are now trashed — reload both lists
    const [p, t] = await Promise.all([
      fetch('/api/papers').then(r => r.json()),
      fetch('/api/papers/trash').then(r => r.json()),
    ]);
    setPapers(p);
    setTrashedPapers(t);
  }

  async function handleMovePaper(paperId: string, folderId: string) {
    setPapers(prev => prev.map(p => p.id === paperId ? { ...p, folderId } : p));
    await fetch(`/api/papers/${paperId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId }),
    });
  }

  async function handleMoveFolder(folderId: string, newParentId: string | null) {
    await fetch(`/api/folders/${folderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: newParentId }),
    });
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, parentId: newParentId } : f));
  }

  // ── Paper handlers ─────────────────────────────────────────────────
  async function handleStatusChange(id: string, status: ReadingStatus) {
    setPapers(prev => prev.map(p => p.id === id ? { ...p, readingStatus: status } : p));
    await fetch(`/api/papers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readingStatus: status }),
    });
  }

  function handleAdded(paper: Paper) {
    setPapers(prev => [paper, ...prev]);
  }

  async function handleDelete(id: string) {
    const paper = papers.find(p => p.id === id);
    setPapers(prev => prev.filter(p => p.id !== id));
    await fetch(`/api/papers/${id}`, { method: 'DELETE' });
    if (paper) setTrashedPapers(prev => [{ ...paper, trashedAt: new Date().toISOString() }, ...prev]);
  }

  // ── Trash handlers ─────────────────────────────────────────────────
  async function handleRestore(id: string) {
    const res = await fetch(`/api/papers/${id}/restore`, { method: 'POST' });
    const restored: Paper = await res.json();
    setTrashedPapers(prev => prev.filter(p => p.id !== id));
    setPapers(prev => [restored, ...prev]);
  }

  async function handleDeletePermanent(id: string) {
    setTrashedPapers(prev => prev.filter(p => p.id !== id));
    await fetch(`/api/papers/${id}?permanent=true`, { method: 'DELETE' });
  }

  async function handleEmptyTrash() {
    setTrashedPapers([]);
    await fetch('/api/papers/trash', { method: 'DELETE' });
  }

  const flatFolders = flattenFolders(folders);

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      <FolderSidebar
        folders={folders}
        papers={papers}
        selected={selectedView}
        trashCount={trashedPapers.length}
        onSelect={setSelectedView}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onMovePaper={handleMovePaper}
        onMoveFolder={handleMoveFolder}
      />

      <div className="flex-1 min-w-0 overflow-auto">
        {selectedView === 'trash' ? (
          <TrashView
            papers={trashedPapers}
            onRestore={handleRestore}
            onDeletePermanent={handleDeletePermanent}
            onEmptyTrash={handleEmptyTrash}
          />
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">
                {selectedView === 'all'
                  ? 'All Papers'
                  : folders.find(f => f.id === selectedView)?.name ?? 'Papers'}
              </h1>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5v14" />
                </svg>
                Add paper
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : visiblePapers.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-400 dark:text-zinc-600 text-sm mb-3">No papers here</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Add your first paper →
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {visiblePapers.map(paper => (
                  <PaperCard
                    key={paper.id}
                    paper={paper}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <AddPaperModal
          onClose={() => setShowModal(false)}
          onAdded={handleAdded}
          folders={flatFolders}
          defaultFolderId={defaultFolderId}
        />
      )}
    </div>
  );
}
