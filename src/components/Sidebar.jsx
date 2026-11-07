import React, { useState, useMemo } from 'react';
import Dialog from './Dialog';
import { getBadge, getKind } from '../utils/templates';
import { buildTree, flattenTree, parentOf, isInside } from '../utils/paths';

const ACTION =
  'w-full flex items-center gap-3 h-12 px-3 rounded-lg text-sm font-mono text-left text-slate-200 active:bg-slate-800 sm:hover:bg-slate-800 cursor-pointer';

const ICON_BTN =
  'h-9 w-9 flex-shrink-0 flex items-center justify-center rounded bg-slate-800 active:bg-slate-700 text-base cursor-pointer';

export default function Sidebar({
  isOpen,
  toggleSidebar,
  items,
  expanded,
  activeFileId,
  onSelectFile,
  onToggleFolder,
  onCreateFile,
  onCreateFolder,
  onRename,
  onMove,
  onDelete,
  onDownload,
  onUploadFiles
}) {
  const [target, setTarget] = useState(''); // new file new folder upload file here
  const [menu, setMenu] = useState(null);   
  const [dialog, setDialog] = useState(null);

  
  const activeTarget =
    target === '' || items.some((i) => i.kind === 'folder' && i.path === target)
      ? target
      : '';

  const rows = useMemo(
    () => flattenTree(buildTree(items), expanded),
    [items, expanded]
  );

  const folderCount = items.filter((i) => i.kind === 'folder').length;
  const fileCount = items.length - folderCount;

  const closeMenu = () => setMenu(null);

  const openDialog = (d) => {
    setMenu(null);
    setDialog(d);
  };

  const handleRowClick = (item) => {
    if (item.kind === 'folder') {
      onToggleFolder(item.path);
      setTarget(item.path);
    } else {
      onSelectFile(item);
      setTarget(parentOf(item.path));
      if (window.innerWidth < 640) toggleSidebar();
    }
  };

  const handlePick = (e, parent, afterPick) => {
    const picked = Array.from(e.target.files || []); 
    e.target.value = '';                             
    afterPick?.();
    if (picked.length > 0) onUploadFiles(picked, parent);
  };

  
  const moveOptions = (item) => {
    const folders = items
      .filter(
        (i) =>
          i.kind === 'folder' &&
          !(item.kind === 'folder' && isInside(i.path, item.path))
      )
      .sort((a, b) => a.path.localeCompare(b.path));

    return [
      { value: '', label: '/ (root)', depth: 0 },
      ...folders.map((f) => ({
        value: f.path,
        label: f.name,
        depth: f.path.split('/').length
      }))
    ];
  };

  const renderDialog = () => {
    if (!dialog) return null;

    const close = () => setDialog(null);
    const { type, item, parent = '' } = dialog;

    if (type === 'newFile') {
      return (
        <Dialog
          title="New file"
          message={`Folder: /${parent}\nWrite name`}
          input
          placeholder="index.html"
          confirmLabel="Create"
          onConfirm={(v) => onCreateFile(parent, v)}
          onClose={close}
        />
      );
    }

    if (type === 'newFolder') {
      return (
        <Dialog
          title="New folder"
          message={`Folder: /${parent}`}
          input
          placeholder="images"
          confirmLabel="Create"
          onConfirm={(v) => onCreateFolder(parent, v)}
          onClose={close}
        />
      );
    }

    if (type === 'rename') {
      return (
        <Dialog
          title="Rename"
          message={`/${item.path}`}
          input
          selectBase={item.kind !== 'folder'}
          defaultValue={item.name}
          confirmLabel="Rename"
          onConfirm={(v) => onRename(item, v)}
          onClose={close}
        />
      );
    }

    if (type === 'move') {
      return (
        <Dialog
          title="Move"
          message={`"${item.name}"In which folder should this be placed?`}
          options={moveOptions(item)}
          defaultValue={parentOf(item.path)}
          confirmLabel="Move"
          onConfirm={(dest) => onMove(item, dest)}
          onClose={close}
        />
      );
    }

    if (type === 'delete') {
      const inside =
        item.kind === 'folder'
          ? items.filter((i) => i.id !== item.id && isInside(i.path, item.path)).length
          : 0;

      return (
        <Dialog
          title={item.kind === 'folder' ? 'Delete the folder?' : 'Delete the file?'}
          message={
            item.kind === 'folder'
              ? `"${item.path}" And those inside it ${inside} They will be deleted.\n\nThis will not come back.`
              : `"${item.path}" It will be deleted.\n\nThis will not come back.`
          }
          confirmLabel="Delete"
          danger
          onConfirm={() => onDelete(item)}
          onClose={close}
        />
      );
    }

    return null;
  };

  return (
    <>
      {isOpen && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm sm:hidden"
        />
      )}

      <aside
        className={`
          fixed sm:relative z-50 inset-y-0 left-0 h-full
          flex flex-col w-72 sm:w-64 max-w-[85vw] bg-slate-900 border-r border-slate-800 text-slate-300 flex-shrink-0 select-none
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0 sm:flex'}
        `}
      >
        {/* HEADER */}
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/40 px-3">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
            Explorer
          </span>

          <div className="flex items-center gap-1.5">
            <label title="Upload file" className={`${ICON_BTN} text-pink-400`}>
              📎
              <input
                type="file"
                multiple
                onChange={(e) => handlePick(e, activeTarget)}
                className="sr-only"
              />
            </label>

            <button
              title="New file"
              onClick={() => openDialog({ type: 'newFile', parent: activeTarget })}
              className={`${ICON_BTN} text-cyan-400`}
            >
              📄
            </button>

            <button
              title="New folder"
              onClick={() => openDialog({ type: 'newFolder', parent: activeTarget })}
              className={`${ICON_BTN} text-amber-400`}
            >
              📁
            </button>
          </div>
        </div>

        {/* TARGET STRIP */}
        <div className="flex h-7 shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-3 text-[10px] font-mono text-slate-500">
          <span className="truncate">Something new will be built here:/{activeTarget}</span>
          {activeTarget && (
            <button onClick={() => setTarget('')} className="flex-shrink-0 text-cyan-400">
              root
            </button>
          )}
        </div>

        {/* TREE */}
        <div className="flex-1 overflow-y-auto p-1.5">
          {rows.length === 0 && (
            <div className="p-4 text-center text-xs font-mono text-slate-600">
              Empty. 📄 or 📁 click.
            </div>
          )}

          {rows.map(({ item, depth }) => {
            const isFolder = item.kind === 'folder';
            const isOpenFolder = isFolder && expanded.has(item.path);
            const isActive = !isFolder && item.id === activeFileId;
            const isTarget = isFolder && activeTarget === item.path;
            const isImg = !isFolder && getKind(item) === 'image';
            const badge = getBadge(item.name);

            return (
              <div
                key={item.id}
                style={{ paddingLeft: 6 + depth * 14 }}
                className={`flex min-h-[42px] cursor-pointer items-center justify-between gap-1 rounded-lg border pr-1 text-xs font-mono ${
                  isActive
                    ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                    : isTarget
                    ? 'border-slate-700 bg-slate-800/60 text-slate-200'
                    : 'border-transparent text-slate-400 active:bg-slate-800 sm:hover:bg-slate-800/60'
                }`}
              >
                <div
                  onClick={() => handleRowClick(item)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 self-stretch"
                >
                  <span className="w-3 flex-shrink-0 text-center text-[10px] text-slate-500">
                    {isFolder ? (isOpenFolder ? '▾' : '▸') : ''}
                  </span>

                  {isFolder ? (
                    <span className="flex-shrink-0 text-base">{isOpenFolder ? '📂' : '📁'}</span>
                  ) : isImg ? (
                    <img
                      src={item.content}
                      alt=""
                      className="h-6 w-8 flex-shrink-0 rounded bg-slate-800 object-cover"
                    />
                  ) : (
                    <span className={`${badge.color} w-9 flex-shrink-0 text-[10px] font-bold`}>
                      {badge.label}
                    </span>
                  )}

                  <span className="truncate text-sm">{item.name}</span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenu(item);
                  }}
                  title="Options"
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-lg text-slate-400 active:bg-slate-700"
                >
                  ⋮
                </button>
              </div>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-slate-800 px-3 py-2 text-[10px] font-mono text-slate-500">
          {fileCount} files · {folderCount} folders
        </div>
      </aside>

      {/* ⋮ MENU (bottom sheet)*/}
      {menu && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 sm:items-center"
          onClick={closeMenu}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-2xl border border-slate-700 bg-slate-900 p-2 sm:rounded-2xl"
            style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
          >
            <div className="truncate px-3 py-2 text-xs font-mono text-slate-500">
              {menu.kind === 'folder' ? '📁' : '📄'} /{menu.path}
            </div>

            {menu.kind === 'folder' && (
              <>
                <button
                  className={ACTION}
                  onClick={() => openDialog({ type: 'newFile', parent: menu.path })}
                >
                  <span>📄</span> New file
                </button>

                <button
                  className={ACTION}
                  onClick={() => openDialog({ type: 'newFolder', parent: menu.path })}
                >
                  <span>📁</span> New folder
                </button>

                <label className={ACTION}>
                  <span>📎</span> Upload here
                  <input
                    type="file"
                    multiple
                    onChange={(e) => handlePick(e, menu.path, closeMenu)}
                    className="sr-only"
                  />
                </label>
              </>
            )}

            <button className={ACTION} onClick={() => openDialog({ type: 'rename', item: menu })}>
              <span>✏️</span> Rename
            </button>

            <button className={ACTION} onClick={() => openDialog({ type: 'move', item: menu })}>
              <span>📂</span> Move
            </button>

            <button
              className={ACTION}
              onClick={() => {
                onDownload(menu);
                closeMenu();
              }}
            >
              <span>⬇️</span> {menu.kind === 'folder' ? 'Download (ZIP)' : 'Download'}
            </button>

            <button
              className={`${ACTION} !text-rose-400`}
              onClick={() => openDialog({ type: 'delete', item: menu })}
            >
              <span>🗑️</span> Delete
            </button>
          </div>
        </div>
      )}

      {renderDialog()}
    </>
  );
}