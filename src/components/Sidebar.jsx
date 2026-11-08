import React, { useState, useMemo, useRef, useEffect } from 'react';
import { getBadge, getKind } from '../utils/templates';
import { buildTree, flattenTree, parentOf, isInside } from '../utils/paths';

/* ---------- VS Code style icons (16x16) ---------- */
const Svg = ({ children, className = 'h-4 w-4', fill = 'currentColor', ...p }) => (
  <svg viewBox="0 0 16 16" fill={fill} className={className} aria-hidden="true" {...p}>
    {children}
  </svg>
);

const IconNewFile = () => (
  <Svg>
    <path d="M9.5 1.1l3.4 3.5.1.4v2h-1V6H8V2H3v11h4v1H2.5l-.5-.5v-12l.5-.5h6.7l.3.1zM9 2v3h2.9L9 2zm4 14h-1v-3H9v-1h3V9h1v3h3v1h-3v3z" />
  </Svg>
);

const IconNewFolder = () => (
  <Svg>
    <path d="M14.5 2H7.71l-.85-.85L6.51 1h-5l-.5.5v11l.5.5H7v-1H1.99V6h4.49l.35-.15.86-.85H14v1.5l.01.01V6H15V2.5l-.5-.5zm0 3H7.5l-.35.15-.86.85H2V2h4.29l.85.85.36.15H14l.01.01V5zM13 16h-1v-3H9v-1h3V9h1v3h3v1h-3v3z" />
  </Svg>
);

const IconFile = () => (
  <Svg className="h-4 w-4 text-slate-400">
    <path d="M9.5 1H3.5l-.5.5v13l.5.5h9l.5-.5V4.5L9.5 1zM9 2l3 3H9V2zM4 14V2h4v4h4v8H4z" />
  </Svg>
);

const IconUpload = () => (
  <Svg>
    <path d="M8 1.5l.35.15 3.5 3.5-.7.7L8.5 3.2V10h-1V3.2L4.85 5.85l-.7-.7 3.5-3.5L8 1.5zM2 11h1v2.5h10V11h1v3H2v-3z" />
  </Svg>
);

const IconChevron = ({ open }) => (
  <Svg className={`h-4 w-4 transition-transform duration-100 ${open ? 'rotate-90' : ''}`}>
    <path d="M10.072 8.024L5.715 3.667l.618-.62L11 7.716v.618L6.333 13l-.618-.619 4.357-4.357z" />
  </Svg>
);

const IconFolder = ({ open }) => (
  <Svg className="h-4 w-4 text-amber-400">
    {open ? (
      <path d="M1.5 3h4.7l1 1H14a.5.5 0 01.5.5V6H3.2L1 12V3.5A.5.5 0 011.5 3zM3.6 7H15l-2.1 6H1.5l2.1-6z" />
    ) : (
      <path d="M1.5 2.5h4.7l1 1H14a.5.5 0 01.5.5v8.5a.5.5 0 01-.5.5H1.5a.5.5 0 01-.5-.5V3a.5.5 0 01.5-.5z" />
    )}
  </Svg>
);

const IconDots = () => (
  <Svg>
    <circle cx="8" cy="3" r="1.2" />
    <circle cx="8" cy="8" r="1.2" />
    <circle cx="8" cy="13" r="1.2" />
  </Svg>
);

const IconTrash = ({ className }) => (
  <Svg className={className || 'h-4 w-4'}>
    <path d="M10 3h3v1h-1v9l-1 1H5l-1-1V4H3V3h3V2a1 1 0 011-1h2a1 1 0 011 1v1zM7 2v1h2V2H7zM5 4v9h6V4H5zm1 1h1v7H6V5zm3 0h1v7H9V5z" />
  </Svg>
);

const IconCut = () => (
  <Svg fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
    <circle cx="4.5" cy="12" r="2" />
    <circle cx="11.5" cy="12" r="2" />
    <path d="M5.4 10.2L11.5 2M10.6 10.2L4.5 2" />
  </Svg>
);

const IconPaste = () => (
  <Svg>
    <path d="M10 1H6v1H3.5l-.5.5v12l.5.5h9l.5-.5v-12l-.5-.5H10V1zM7 2h2v2H7V2zM4 3h2v2h4V3h2v11H4V3z" />
  </Svg>
);

const IconCollapse = () => (
  <Svg>
    <path d="M9 9H4v1h5V9z" />
    <path d="M7 12V7H2v7h7v-2h5V2H7v5h1V3h6v8H9v1H3V8h4v4z" />
  </Svg>
);

const IconCheck = () => (
  <Svg>
    <path d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.764.646z" />
  </Svg>
);

const IconClose = () => (
  <Svg>
    <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z" />
  </Svg>
);

/* ---------- helpers ---------- */
const HEAD_BTN =
  'h-7 w-7 flex-shrink-0 flex items-center justify-center rounded text-slate-400 active:bg-slate-700 sm:hover:bg-slate-700/70 sm:hover:text-slate-100 cursor-pointer';

const MENU_W = 208;
const ITEM_H = 28;

/* Runs a handler and returns null on success or an error string (also catches throws) */
const run = async (fn) => {
  try {
    const err = await fn();
    return typeof err === 'string' && err ? err : null;
  } catch (ex) {
    return ex?.message || 'Something went wrong.';
  }
};

/* ---------- VS Code style context menu parts ---------- */
const MenuItem = ({ children, onClick, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`flex h-7 w-full items-center px-3 text-left text-[13px] ${
      disabled
        ? 'cursor-default text-slate-600'
        : 'cursor-pointer text-slate-200 active:bg-cyan-600 active:text-white sm:hover:bg-cyan-600 sm:hover:text-white'
    }`}
  >
    {children}
  </button>
);

const MenuSep = () => <div className="mx-2 my-1 h-px bg-slate-700" />;

/* ---------- VS Code style inline input (cyan border) ---------- */
function InlineInput({ defaultValue = '', placeholder = '', selectBase = false, onSubmit, onCancel }) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState('');
  const ref = useRef(null);
  const done = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    if (selectBase) {
      // Select only the name part, keep the extension untouched
      const dot = defaultValue.lastIndexOf('.');
      el.setSelectionRange(0, dot > 0 ? dot : defaultValue.length);
    } else {
      el.select();
    }
    // eslint-disable-next-line
  }, []);

  const cancel = () => {
    done.current = true;
    onCancel();
  };

  const submit = async () => {
    if (done.current || busy.current) return;
    const v = value.trim();
    if (!v || v === defaultValue) return cancel();

    busy.current = true;
    const err = await run(() => onSubmit(v));
    busy.current = false;

    if (err) {
      setError(err);
      ref.current?.focus();
    } else {
      cancel();
    }
  };

  return (
    <div className="relative min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
      <input
        ref={ref}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          setValue(e.target.value);
          setError('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        onBlur={submit}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={`h-5 w-full rounded-sm border bg-slate-950 px-1 text-[13px] text-slate-100 outline-none ${
          error ? 'border-rose-500' : 'border-cyan-500'
        }`}
      />
      {error && (
        <div className="absolute left-0 top-full z-20 mt-px w-full min-w-[11rem] break-words border border-rose-500 bg-rose-950 px-2 py-1 text-[11px] leading-snug text-rose-200">
          {error}
        </div>
      )}
    </div>
  );
}

/* ---------- Move picker (quick-pick style panel inside the explorer) ---------- */
function MovePicker({ item, items, onMove, onClose }) {
  const current = parentOf(item.path);
  const [dest, setDest] = useState(current);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Root + every folder, excluding the item itself and anything inside it
  const options = useMemo(() => {
    const folders = items
      .filter(
        (i) =>
          i.kind === 'folder' &&
          i.path !== item.path &&
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
  }, [items, item]);

  const submit = async () => {
    if (busy) return;
    if (dest === current) {
      setError('Already in this folder.');
      return;
    }
    setBusy(true);
    const err = await run(() => onMove(item, dest));
    setBusy(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-10 z-30 flex flex-col border-t border-cyan-500 bg-slate-900">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-950/60 px-3">
        <span className="min-w-0 flex-1 truncate text-[11px] text-slate-300">
          Move <span className="font-mono text-cyan-300">{item.name}</span> to...
        </span>
        <button
          title="Close"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 active:bg-slate-700 sm:hover:bg-slate-700"
        >
          <IconClose />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {options.map((opt) => {
          const selected = dest === opt.value;
          return (
            <button
              key={opt.value || '__root__'}
              type="button"
              onClick={() => {
                setDest(opt.value);
                setError('');
              }}
              style={{ paddingLeft: 12 + opt.depth * 12 }}
              className={`flex h-7 w-full items-center gap-2 pr-3 text-left text-[13px] ${
                selected
                  ? 'bg-cyan-500/20 text-white'
                  : 'text-slate-300 active:bg-slate-800 sm:hover:bg-slate-800/60'
              }`}
            >
              <IconFolder open={selected} />
              <span className="min-w-0 flex-1 truncate">{opt.label}</span>
              {opt.value === current && (
                <span className="flex-shrink-0 text-[10px] text-slate-500">current</span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="shrink-0 border-t border-rose-500 bg-rose-950 px-3 py-1.5 text-[11px] text-rose-200">
          {error}
        </div>
      )}

      <div className="flex shrink-0 gap-2 border-t border-slate-800 p-2">
        <button
          onClick={onClose}
          className="h-8 flex-1 rounded bg-slate-800 text-xs text-slate-300 active:bg-slate-700"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="h-8 flex-1 rounded bg-cyan-500 text-xs font-bold text-slate-950 active:bg-cyan-400 disabled:opacity-60"
        >
          Move here
        </button>
      </div>
    </div>
  );
}

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
  onUploadFiles,
  onCollapseAll // optional
}) {
  const [target, setTarget] = useState('');
  const [menu, setMenu] = useState(null); // { item, x, y }
  const [creating, setCreating] = useState(null); // { kind: 'file' | 'folder', parent }
  const [renamingId, setRenamingId] = useState(null);
  const [confirmDelId, setConfirmDelId] = useState(null);
  const [moving, setMoving] = useState(null); // item being moved via the picker
  const [cut, setCut] = useState(null); // item waiting to be pasted
  const [note, setNote] = useState('');

  const activeTarget =
    target === '' || items.some((i) => i.kind === 'folder' && i.path === target)
      ? target
      : '';

  const rows = useMemo(
    () => flattenTree(buildTree(items), expanded),
    [items, expanded]
  );

  const cutItem = cut ? items.find((i) => i.id === cut.id) : null;
  // Re-read the moving item from items so the picker never works on a stale path
  const movingItem = moving ? items.find((i) => i.id === moving.id) : null;

  const folderCount = items.filter((i) => i.kind === 'folder').length;
  const fileCount = items.length - folderCount;

  const closeMenu = () => setMenu(null);

  // Opens the menu and keeps it inside the screen
  const openMenu = (item, x, y) => {
    const count = item.kind === 'folder' ? 9 : 5;
    const h = count * ITEM_H + 48;
    setMenu({
      item,
      x: Math.max(8, Math.min(x, window.innerWidth - MENU_W - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - h - 8))
    });
  };

  // Only one mode (create / rename / delete / move) can be active at a time
  const resetModes = () => {
    setMenu(null);
    setCreating(null);
    setRenamingId(null);
    setConfirmDelId(null);
    setMoving(null);
  };

  const startCreate = (kind, parent) => {
    resetModes();
    if (parent && !expanded.has(parent)) onToggleFolder(parent);
    setCreating({ kind, parent });
  };

  const startRename = (item) => {
    resetModes();
    setRenamingId(item.id);
  };

  const startDelete = (item) => {
    resetModes();
    setConfirmDelId(item.id);
  };

  const startMove = (item) => {
    resetModes();
    setMoving(item);
  };

  const startCut = (item) => {
    resetModes();
    setNote('');
    setCut(item);
  };

  const cancelCut = () => {
    setCut(null);
    setNote('');
  };

  const doPaste = async (dest) => {
    if (!cutItem) return;
    if (cutItem.kind === 'folder' && (dest === cutItem.path || isInside(dest, cutItem.path))) {
      setNote('A folder cannot be moved into itself.');
      return;
    }
    if (parentOf(cutItem.path) === dest) {
      setNote('Already in this folder.');
      return;
    }
    const err = await run(() => onMove(cutItem, dest));
    if (err) setNote(err);
    else cancelCut();
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

  const handlePick = (e, parent) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    closeMenu();
    if (picked.length > 0) onUploadFiles(picked, parent);
  };

  // Inline row used to type the name of a new file or folder
  const renderCreateRow = (depth) => (
    <div
      key="__creating__"
      style={{ paddingLeft: 4 + depth * 12 }}
      className="flex h-7 items-center gap-1 pr-2"
    >
      <span className="w-4 flex-shrink-0" />
      <span className="flex-shrink-0">
        {creating.kind === 'folder' ? <IconFolder open={false} /> : <IconFile />}
      </span>
      <InlineInput
        placeholder={creating.kind === 'folder' ? 'folder name' : 'file name'}
        onSubmit={(v) =>
          creating.kind === 'folder'
            ? onCreateFolder(creating.parent, v)
            : onCreateFile(creating.parent, v)
        }
        onCancel={() => setCreating(null)}
      />
    </div>
  );

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
        <div className="flex h-10 shrink-0 items-center justify-between gap-2 bg-slate-950/40 pl-4 pr-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Explorer
          </span>

          <div className="flex items-center">
            <button
              title="New File"
              onClick={() => startCreate('file', activeTarget)}
              className={HEAD_BTN}
            >
              <IconNewFile />
            </button>

            <button
              title="New Folder"
              onClick={() => startCreate('folder', activeTarget)}
              className={HEAD_BTN}
            >
              <IconNewFolder />
            </button>

            <label title="Upload" className={HEAD_BTN}>
              <IconUpload />
              <input
                type="file"
                multiple
                onChange={(e) => handlePick(e, activeTarget)}
                className="sr-only"
              />
            </label>

            {onCollapseAll && (
              <button title="Collapse All" onClick={onCollapseAll} className={HEAD_BTN}>
                <IconCollapse />
              </button>
            )}
          </div>
        </div>

        {/* TARGET STRIP */}
        <div className="flex h-6 shrink-0 items-center justify-between gap-2 border-y border-slate-800 px-4 text-[10px] font-mono text-slate-500">
          <span className="truncate">new items → /{activeTarget}</span>
          {activeTarget && (
            <button onClick={() => setTarget('')} className="flex-shrink-0 text-cyan-400">
              root
            </button>
          )}
        </div>

        {/* CUT / PASTE STRIP */}
        {cutItem && (
          <div className="shrink-0 border-b border-slate-800 bg-slate-950/60 px-3 py-1.5">
            <div className="flex items-center gap-2 text-[11px] text-slate-300">
              <IconCut />
              <span className="min-w-0 flex-1 truncate font-mono">{cutItem.name}</span>
              <button
                onClick={() => doPaste(activeTarget)}
                className="flex h-6 items-center gap-1 rounded bg-cyan-500 px-2 text-[11px] font-bold text-slate-950 active:bg-cyan-400"
              >
                <IconPaste /> Paste /{activeTarget}
              </button>
              <button
                title="Cancel"
                onClick={cancelCut}
                className="flex h-6 w-6 items-center justify-center rounded text-slate-400 active:bg-slate-700"
              >
                <IconClose />
              </button>
            </div>
            {note && <div className="mt-1 text-[11px] text-rose-400">{note}</div>}
          </div>
        )}

        {/* TREE */}
        <div className="flex-1 overflow-y-auto py-1">
          {rows.length === 0 && !creating && (
            <div className="p-4 text-center text-xs text-slate-600">
              No files yet. Use New File or New Folder above.
            </div>
          )}

          {/* Create row at the root level */}
          {creating && creating.parent === '' && renderCreateRow(0)}

          {rows.map(({ item, depth }) => {
            const isFolder = item.kind === 'folder';
            const isOpenFolder = isFolder && expanded.has(item.path);
            const isActive = !isFolder && item.id === activeFileId;
            const isTarget = isFolder && activeTarget === item.path;
            const isImg = !isFolder && getKind(item) === 'image';
            const isCut = cutItem && cutItem.id === item.id;
            const isRenaming = renamingId === item.id;
            const isDeleting = confirmDelId === item.id;
            const badge = getBadge(item.name);

            const inside = isFolder
              ? items.filter((i) => i.id !== item.id && isInside(i.path, item.path)).length
              : 0;

            return (
              <React.Fragment key={item.id}>
                <div
                  style={{ paddingLeft: 4 + depth * 12 }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!isRenaming && !isDeleting) openMenu(item, e.clientX, e.clientY);
                  }}
                  className={`group flex h-7 cursor-pointer items-center justify-between pr-1 text-[13px] ${
                    isDeleting
                      ? 'bg-rose-500/15 text-rose-200'
                      : isActive
                      ? 'bg-cyan-500/15 text-white'
                      : isTarget
                      ? 'bg-slate-800/70 text-slate-100'
                      : 'text-slate-300 active:bg-slate-800 sm:hover:bg-slate-800/60'
                  } ${isCut ? 'opacity-50' : ''}`}
                >
                  <div
                    onClick={() => !isRenaming && !isDeleting && handleRowClick(item)}
                    className="flex min-w-0 flex-1 items-center gap-1 self-stretch"
                  >
                    <span className="flex w-4 flex-shrink-0 items-center justify-center text-slate-400">
                      {isFolder ? <IconChevron open={isOpenFolder} /> : null}
                    </span>

                    {isFolder ? (
                      <span className="flex-shrink-0">
                        <IconFolder open={isOpenFolder} />
                      </span>
                    ) : isImg ? (
                      <img
                        src={item.content}
                        alt=""
                        className="h-4 w-4 flex-shrink-0 rounded-sm bg-slate-800 object-cover"
                      />
                    ) : (
                      <span className={`${badge.color} w-6 flex-shrink-0 text-[9px] font-bold`}>
                        {badge.label}
                      </span>
                    )}

                    {isRenaming ? (
                      <InlineInput
                        defaultValue={item.name}
                        selectBase={!isFolder}
                        onSubmit={(v) => onRename(item, v)}
                        onCancel={() => setRenamingId(null)}
                      />
                    ) : isDeleting ? (
                      <span className="truncate text-xs">
                        Delete {item.name}
                        {isFolder && inside > 0 ? ` (+${inside})` : ''}?
                      </span>
                    ) : (
                      <span className="truncate">{item.name}</span>
                    )}
                  </div>

                  {isDeleting ? (
                    <div className="flex flex-shrink-0 items-center gap-0.5">
                      <button
                        title="Confirm delete"
                        onClick={async () => {
                          const err = await run(() => onDelete(item));
                          if (!err) setConfirmDelId(null);
                        }}
                        className="flex h-6 w-7 items-center justify-center rounded bg-rose-600 text-white active:bg-rose-500"
                      >
                        <IconCheck />
                      </button>
                      <button
                        title="Cancel"
                        onClick={() => setConfirmDelId(null)}
                        className="flex h-6 w-7 items-center justify-center rounded bg-slate-700 text-slate-200 active:bg-slate-600"
                      >
                        <IconClose />
                      </button>
                    </div>
                  ) : (
                    !isRenaming && (
                      <div className="flex flex-shrink-0 items-center">
                        {/* Desktop: direct delete button on row hover */}
                        <button
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            startDelete(item);
                          }}
                          className="hidden h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-700 hover:text-rose-400 sm:group-hover:flex"
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                        </button>

                        <button
                          title="More"
                          onClick={(e) => {
                            e.stopPropagation();
                            const r = e.currentTarget.getBoundingClientRect();
                            openMenu(item, r.right - MENU_W, r.bottom + 2);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded text-slate-400 active:bg-slate-700 sm:hidden sm:group-hover:flex sm:hover:bg-slate-700"
                        >
                          <IconDots />
                        </button>
                      </div>
                    )
                  )}
                </div>

                {/* Create row inside this folder */}
                {creating && isFolder && creating.parent === item.path && renderCreateRow(depth + 1)}
              </React.Fragment>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-slate-800 px-4 py-1.5 text-[10px] font-mono text-slate-500">
          {fileCount} files · {folderCount} folders
        </div>

        {/* MOVE PICKER (covers the tree area) */}
        {movingItem && (
          <MovePicker
            item={movingItem}
            items={items}
            onMove={onMove}
            onClose={() => setMoving(null)}
          />
        )}
      </aside>

      {/* VS CODE STYLE CONTEXT MENU */}
      {menu && (
        <div
          className="fixed inset-0 z-[70]"
          onClick={closeMenu}
          onContextMenu={(e) => {
            e.preventDefault();
            closeMenu();
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ left: menu.x, top: menu.y, width: MENU_W }}
            className="absolute rounded-md border border-slate-700 bg-slate-800 py-1 shadow-2xl shadow-black/60"
          >
            {menu.item.kind === 'folder' && (
              <>
                <MenuItem onClick={() => startCreate('file', menu.item.path)}>New File</MenuItem>
                <MenuItem onClick={() => startCreate('folder', menu.item.path)}>New Folder</MenuItem>
                <MenuSep />

                {/* The file picker must stay mounted until a file is chosen, so the menu is not closed early */}
                <label className="flex h-7 w-full cursor-pointer items-center px-3 text-[13px] text-slate-200 active:bg-cyan-600 active:text-white sm:hover:bg-cyan-600 sm:hover:text-white">
                  Upload Here
                  <input
                    type="file"
                    multiple
                    onChange={(e) => handlePick(e, menu.item.path)}
                    className="sr-only"
                  />
                </label>
                <MenuSep />
              </>
            )}

            <MenuItem onClick={() => startCut(menu.item)}>Cut</MenuItem>
            {menu.item.kind === 'folder' && (
              <MenuItem
                disabled={!cutItem}
                onClick={() => {
                  const dest = menu.item.path;
                  closeMenu();
                  doPaste(dest);
                }}
              >
                Paste
              </MenuItem>
            )}
            <MenuItem onClick={() => startMove(menu.item)}>Move...</MenuItem>
            <MenuSep />

            <MenuItem
              onClick={() => {
                onDownload(menu.item);
                closeMenu();
              }}
            >
              {menu.item.kind === 'folder' ? 'Download (ZIP)' : 'Download'}
            </MenuItem>
            <MenuSep />

            <MenuItem onClick={() => startRename(menu.item)}>Rename</MenuItem>
            <MenuItem onClick={() => startDelete(menu.item)}>Delete</MenuItem>
          </div>
        </div>
      )}
    </>
  );
}