'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Folder, Paper } from '@/lib/types';

interface Props {
  folders: Folder[];
  papers: Paper[];
  selected: string;
  trashCount: number;
  onSelect: (view: string) => void;
  onCreateFolder: (name: string, parentId: string | null) => Promise<Folder>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onMovePaper: (paperId: string, folderId: string) => Promise<void>;
  onMoveFolder: (folderId: string, newParentId: string | null) => Promise<void>;
}

type TreeNode = Folder & { children: TreeNode[] };
type ContextMenu = { x: number; y: number; folder: Folder };

function buildTree(folders: Folder[], parentId: string | null = null): TreeNode[] {
  return folders
    .filter(f => f.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(f => ({ ...f, children: buildTree(folders, f.id) }));
}

function isDescendantOf(folders: Folder[], ancestorId: string, targetId: string): boolean {
  let node = folders.find(f => f.id === targetId);
  while (node?.parentId) {
    if (node.parentId === ancestorId) return true;
    node = folders.find(f => f.id === node!.parentId);
  }
  return false;
}

const ChevronRight = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const FolderIcon = ({ open }: { open?: boolean }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open
      ? <path d="M6 14l1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
      : <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    }
  </svg>
);

const PaperIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const MIN_WIDTH = 160;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 208;

export default function FolderSidebar({
  folders,
  papers,
  selected,
  trashCount,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMovePaper,
  onMoveFolder,
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [creatingIn, setCreatingIn] = useState<string | 'ROOT' | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const tree = buildTree(folders);

  useEffect(() => {
    if (!contextMenu) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-ctxmenu]')) setContextMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [contextMenu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setDeletingFolder(null);
        setRenamingId(null);
        setCreatingIn(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const onMouseMove = (ev: MouseEvent) => {
      setSidebarWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + ev.clientX - startX)));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  const handleDragOver = useCallback((e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(folderId);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain')) as { type: string; id: string };
      if (data.type === 'paper') {
        await onMovePaper(data.id, targetFolderId);
      } else if (data.type === 'folder') {
        if (data.id !== targetFolderId && !isDescendantOf(folders, data.id, targetFolderId)) {
          await onMoveFolder(data.id, targetFolderId);
        }
      }
    } catch { /* malformed drag data */ }
  }, [folders, onMovePaper, onMoveFolder]);

  function openContextMenu(e: React.MouseEvent, folder: Folder) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, folder });
  }

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function startRename(folder: Folder) {
    setContextMenu(null);
    setRenamingId(folder.id);
    setRenameValue(folder.name);
    setTimeout(() => renameInputRef.current?.select(), 0);
  }

  async function confirmRename() {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    if (trimmed) await onRenameFolder(renamingId, trimmed);
    setRenamingId(null);
  }

  function startNewFolder(parentId: string | null) {
    setContextMenu(null);
    if (parentId) setExpandedIds(prev => new Set([...prev, parentId]));
    setCreatingIn(parentId ?? 'ROOT');
    setNewFolderName('');
    setTimeout(() => newFolderInputRef.current?.focus(), 0);
  }

  async function confirmNewFolder() {
    const name = newFolderName.trim();
    if (name) {
      const parentId = creatingIn === 'ROOT' ? null : creatingIn;
      const folder = await onCreateFolder(name, parentId);
      setExpandedIds(prev => new Set([...prev, folder.id]));
      onSelect(folder.id);
    }
    setCreatingIn(null);
  }

  function requestDelete(folder: Folder) {
    setContextMenu(null);
    setDeletingFolder(folder);
  }

  async function confirmDelete() {
    if (!deletingFolder) return;
    await onDeleteFolder(deletingFolder.id);
    if (selected === deletingFolder.id) onSelect('all');
    setDeletingFolder(null);
  }

  function renderNewFolderInput(parentId: string | null, depth: number) {
    if (creatingIn !== (parentId ?? 'ROOT')) return null;
    return (
      <div className="flex items-center gap-1 h-7 pr-2" style={{ paddingLeft: depth * 14 + 10 }}>
        <span className="w-3" />
        <FolderIcon />
        <input
          ref={newFolderInputRef}
          value={newFolderName}
          onChange={e => setNewFolderName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') confirmNewFolder();
            if (e.key === 'Escape') setCreatingIn(null);
          }}
          onBlur={confirmNewFolder}
          placeholder="Folder name"
          className="flex-1 text-xs px-1 py-0.5 border border-blue-400 rounded outline-none bg-white dark:bg-zinc-800 dark:text-zinc-200"
        />
      </div>
    );
  }

  function renderPaper(paper: Paper, depth: number) {
    return (
      <Link
        key={paper.id}
        href={`/papers/${paper.id}`}
        draggable
        onDragStart={e => {
          e.stopPropagation();
          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'paper', id: paper.id }));
          e.dataTransfer.effectAllowed = 'move';
        }}
        className="flex items-center gap-1.5 h-6 pr-2 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-gray-700 dark:hover:text-zinc-200 rounded-sm transition-colors"
        style={{ paddingLeft: depth * 14 + 20 }}
      >
        <PaperIcon />
        <span className="flex-1 text-[11px] truncate">{paper.originalTitle}</span>
      </Link>
    );
  }

  function renderNode(node: TreeNode, depth: number): React.ReactNode {
    const isSelected = selected === node.id;
    const isExpanded = expandedIds.has(node.id);
    const isRenaming = renamingId === node.id;
    const isDragOver = dragOverId === node.id;
    const folderPapers = papers
      .filter(p => p.folderId === node.id)
      .sort((a, b) => a.originalTitle.localeCompare(b.originalTitle));
    const hasChildren = node.children.length > 0 || folderPapers.length > 0 || creatingIn === node.id;

    return (
      <div key={node.id}>
        <div
          className={`group flex items-center gap-1 h-7 pr-2 rounded-sm cursor-pointer select-none transition-colors
            ${isSelected
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
              : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700'}
            ${isDragOver ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
          style={{ paddingLeft: depth * 14 + 2 }}
          onClick={() => !isRenaming && onSelect(node.id)}
          onContextMenu={e => openContextMenu(e, node)}
          draggable={!isRenaming}
          onDragStart={e => {
            e.stopPropagation();
            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'folder', id: node.id }));
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={e => handleDragOver(e, node.id)}
          onDragLeave={handleDragLeave}
          onDrop={e => handleDrop(e, node.id)}
        >
          <span
            className={`w-4 h-4 flex items-center justify-center shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''} ${!hasChildren ? 'opacity-0' : ''}`}
            onClick={e => { e.stopPropagation(); toggleExpand(node.id); }}
          >
            <ChevronRight />
          </span>
          <span className="shrink-0 opacity-70">
            <FolderIcon open={isExpanded} />
          </span>
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmRename();
                if (e.key === 'Escape') setRenamingId(null);
              }}
              onBlur={confirmRename}
              className="flex-1 text-xs px-1 py-0.5 border border-blue-400 rounded outline-none bg-white dark:bg-zinc-800 dark:text-zinc-200 min-w-0"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 text-xs truncate">{node.name}</span>
          )}
        </div>

        {isExpanded && (
          <>
            {node.children.map(child => renderNode(child, depth + 1))}
            {renderNewFolderInput(node.id, depth + 1)}
            {folderPapers.map(paper => renderPaper(paper, depth + 1))}
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative shrink-0 border-r border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 flex flex-col overflow-hidden"
      style={{ width: sidebarWidth }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-zinc-800">
        <span className="text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Library</span>
        <button
          onClick={() => startNewFolder(null)}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-500 dark:text-zinc-400 transition-colors"
          title="New folder"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5v14" />
          </svg>
        </button>
      </div>

      {/* All Papers */}
      <button
        className={`flex items-center gap-2 px-3 py-1.5 text-xs w-full text-left transition-colors
          ${selected === 'all'
            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-medium'
            : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700'}`}
        onClick={() => onSelect('all')}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'none'; }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        All Papers
      </button>

      {/* Folder tree */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-1 py-1">
        {tree.map(node => renderNode(node, 0))}
        {renderNewFolderInput(null, 0)}
      </div>

      {/* Trash */}
      <button
        className={`flex items-center gap-2 px-3 py-2.5 text-sm w-full text-left border-t border-gray-200 dark:border-zinc-800 transition-colors
          ${selected === 'trash'
            ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-medium'
            : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700'}`}
        onClick={() => onSelect('trash')}
      >
        <TrashIcon />
        <span>Trash</span>
        {trashCount > 0 && (
          <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full
            ${selected === 'trash'
              ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
              : 'bg-gray-200 dark:bg-zinc-700 text-gray-500 dark:text-zinc-400'}`}>
            {trashCount}
          </span>
        )}
      </button>

      {/* Resize handle */}
      <div
        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-300 dark:hover:bg-blue-700 active:bg-blue-400 transition-colors"
        onMouseDown={startResize}
      />

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          data-ctxmenu
          className="fixed z-50 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-[148px] text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700 text-xs"
            onClick={() => startNewFolder(contextMenu.folder.id)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <path d="M12 11v6M9 14h6" />
            </svg>
            New Subfolder
          </button>
          <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700 text-xs"
            onClick={() => startRename(contextMenu.folder)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Rename
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs"
            onClick={() => requestDelete(contextMenu.folder)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
            Delete
          </button>
        </div>
      )}

      {/* Delete confirmation overlay */}
      {deletingFolder && (
        <div className="absolute inset-0 bg-black/20 dark:bg-black/50 flex items-end z-40" onClick={() => setDeletingFolder(null)}>
          <div
            className="w-full bg-white dark:bg-zinc-800 border-t border-gray-200 dark:border-zinc-700 p-4 shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-xs font-medium text-gray-800 dark:text-zinc-200 mb-1">Delete &ldquo;{deletingFolder.name}&rdquo;?</p>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mb-3">All papers and subfolders will be moved to Trash.</p>
            <div className="flex gap-2">
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-600 text-white text-xs font-medium py-1.5 rounded-md hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setDeletingFolder(null)}
                className="flex-1 border border-gray-300 dark:border-zinc-600 text-gray-600 dark:text-zinc-400 text-xs font-medium py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
