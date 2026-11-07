import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Editor from '../components/Editor';
import useViewportHeight from '../hooks/useViewportHeight';
import { getAllFilesDB, saveFileDB, saveFileDBStrict, deleteFileDB } from '../utils/db';
import { getBoilerplate, detectKind, IMAGE_EXT } from '../utils/templates';
import {
  MAX_FILE_BYTES,
  readAsDataURL,
  readAsText,
  formatBytes,
  sanitizeName,
  uniqueName
} from '../utils/files';
import {
  newId,
  baseName,
  parentOf,
  joinPath,
  isInside,
  validateName,
  planFolders
} from '../utils/paths';

import { downloadItem } from '../utils/download';
import { Route, Routes } from 'react-router-dom';
import Courses from '../components/CourseComponent';

const normalizeRecords = (list) =>
  list.map((r) => {
    const path = r.path ?? r.name;
    return { ...r, path, name: baseName(path) };
  });

export default function Home() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState([]); // files + folders dono
  const [activeFileId, setActiveFileId] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [toast, setToast] = useState(null); // { type: 'info' | 'ok' | 'error', text }
  const [loaded, setLoaded] = useState(false);

  useViewportHeight();


  const files = useMemo(() => items.filter((i) => i.kind !== 'folder'), [items]);
  const activeFile = files.find((f) => f.id === activeFileId);

  useEffect(() => {
    const initData = async () => {
      const dbItems = normalizeRecords(await getAllFilesDB());

      if (dbItems.length > 0) {
        setItems(dbItems);
        const first =
          dbItems.find((i) => i.path === 'index.html') ||
          dbItems.find((i) => i.kind !== 'folder');
        setActiveFileId(first ? first.id : null);
      } else {
        const initialFile = {
          id: newId(),
          name: 'index.html',
          path: 'index.html',
          kind: 'text',
          content: getBoilerplate('index.html')
        };
        await saveFileDB(initialFile);
        setItems([initialFile]);
        setActiveFileId(initialFile.id);
      }

      setLoaded(true);
    };

    initData();
  }, []);

  // Toast remove automaticly
  useEffect(() => {
    if (!toast || toast.type === 'info') return;
    const t = setTimeout(() => setToast(null), toast.type === 'error' ? 8000 : 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const toggleSidebar = () => setIsOpen((prev) => !prev);

  // ---------- helpers ----------

  const saveRecords = async (records) => {
    try {
      for (const r of records) await saveFileDBStrict(r);
      return null;
    } catch (e) {
      return e?.message || 'It wasn’t saved (check storage)';
    }
  };

  const expandPath = (dir) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      let cur = '';
      dir.split('/').filter(Boolean).forEach((part) => {
        cur = joinPath(cur, part);
        next.add(cur);
      });
      return next;
    });

  const handleToggleFolder = (path) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const pathTaken = (path) =>
    items.some((i) => i.path.toLowerCase() === path.toLowerCase());

  // ---------- create ----------


  const handleCreateFile = async (parent, rawName) => {
    const segs = rawName.trim().split('/').filter(Boolean);
    if (segs.length === 0) return 'The name is empty.';

    for (const s of segs) {
      const e = validateName(s);
      if (e) return e;
    }

    let fileName = segs[segs.length - 1];
    if (!/\.[a-z0-9]+$/i.test(fileName)) {
      fileName = `${fileName}.html`;
      segs[segs.length - 1] = fileName;
    }

    if (detectKind(fileName) !== 'text') {
      return 'A file of this type cannot be created anew. Use upload';
    }

    const path = joinPath(parent, segs.join('/'));
    if (pathTaken(path)) return 'A file or folder with this name already exists.';

    const { folders, error } = planFolders(parentOf(path), items);
    if (error) return error;

    const file = {
      id: newId(),
      name: fileName,
      path,
      kind: 'text',
      content: getBoilerplate(fileName)
    };

    const saveErr = await saveRecords([...folders, file]);
    if (saveErr) return saveErr;

    setItems((prev) => [...prev, ...folders, file]);
    expandPath(parentOf(path));
    setActiveFileId(file.id);
    return null;
  };

  const handleCreateFolder = async (parent, rawName) => {
    const segs = rawName.trim().split('/').filter(Boolean);
    if (segs.length === 0) return 'The name is empty';

    for (const s of segs) {
      const e = validateName(s);
      if (e) return e;
    }

    const path = joinPath(parent, segs.join('/'));
    if (pathTaken(path)) return 'A file or folder with this name already exists.';

    const { folders, error } = planFolders(path, items);
    if (error) return error;

    const saveErr = await saveRecords(folders);
    if (saveErr) return saveErr;

    setItems((prev) => [...prev, ...folders]);
    expandPath(path);
    return null;
  };

  // ---------- rename / move ----------

  const relocate = async (item, newPath) => {
    if (newPath === item.path) return null;

    if (item.kind === 'folder' && isInside(newPath, item.path)) {
      return "You can't keep the folder inside itself";
    }

    const inSubtree = (i) =>
      i.id === item.id || (item.kind === 'folder' && isInside(i.path, item.path));

    const clash = items.some(
      (i) => !inSubtree(i) && i.path.toLowerCase() === newPath.toLowerCase()
    );
    if (clash) return 'A file or folder with this name already exists.';

    const moved = items.filter(inSubtree).map((i) => {
      const p = i.id === item.id ? newPath : newPath + i.path.slice(item.path.length);
      return { ...i, path: p, name: baseName(p) };
    });

    const saveErr = await saveRecords(moved);
    if (saveErr) return saveErr;

    const byId = new Map(moved.map((m) => [m.id, m]));
    setItems((prev) => prev.map((i) => byId.get(i.id) || i));

    if (item.kind === 'folder') {
      setExpanded(
        (prev) =>
          new Set(
            [...prev].map((p) =>
              isInside(p, item.path) ? newPath + p.slice(item.path.length) : p
            )
          )
      );
    }

    return null;
  };

  const handleRename = async (item, rawName) => {
    const name = rawName.trim();
    const e = validateName(name);
    if (e) return e;

    return relocate(item, joinPath(parentOf(item.path), name));
  };

  const handleMove = async (item, destFolder) => {
    const err = await relocate(item, joinPath(destFolder, item.name));
    if (!err) expandPath(destFolder);
    return err;
  };

  // ---------- delete ----------

  const handleDelete = async (item) => {
    const doomed = items.filter(
      (i) => i.id === item.id || (item.kind === 'folder' && isInside(i.path, item.path))
    );

    for (const d of doomed) {
      const ok = await deleteFileDB(d.id);
      if (!ok) return 'It could not be deleted.';
    }

    const ids = new Set(doomed.map((d) => d.id));
    const rest = items.filter((i) => !ids.has(i.id));
    setItems(rest);

    if (ids.has(activeFileId)) {
      const next = rest.find((i) => i.kind !== 'folder');
      setActiveFileId(next ? next.id : null);
    }

    if (item.kind === 'folder') {
      setExpanded((prev) => new Set([...prev].filter((p) => !isInside(p, item.path))));
    }

    return null;
  };

  // ---------- download ----------

  const handleDownload = (item) => {
    try {
      downloadItem(item, items);
    } catch (e) {
      console.error('Download error:', e);
      setToast({ type: 'error', text: `Download nahi hua: ${e?.message || e}` });
    }
  };

  // ---------- upload (kisi bhi folder me) ----------

  const handleUploadFiles = async (fileList, parent = '') => {
    const picked = Array.from(fileList || []);
    if (picked.length === 0) return;

    setToast({ type: 'info', text: `${picked.length} file is adding...` });

    const taken = items
      .filter((i) => parentOf(i.path) === parent)
      .map((i) => i.name.toLowerCase());

    const added = [];
    const failed = [];

    for (const file of picked) {
      try {
        if (file.size > MAX_FILE_BYTES) {
          throw new Error(
            `bahut badi hai (${formatBytes(file.size)}, max ${formatBytes(MAX_FILE_BYTES)})`
          );
        }

        const kind = detectKind(file.name, file.type);
        const content = kind === 'text' ? await readAsText(file) : await readAsDataURL(file);

        let name = sanitizeName(file.name) || 'file';

        if (kind === 'image' && !IMAGE_EXT.test(name)) {
          const ext = (file.type.split('/')[1] || 'png').replace('svg+xml', 'svg');
          name = `${name}.${ext}`;
        }

        name = uniqueName(name, [...taken, ...added.map((a) => a.name.toLowerCase())]);

        const record = {
          id: newId(),
          name,
          path: joinPath(parent, name),
          kind,
          mime: file.type || '',
          content,
          size: file.size
        };

        await saveFileDBStrict(record);
        added.push(record);
      } catch (err) {
        console.error('Upload error:', file.name, err);
        failed.push(`${file.name}: ${err?.message || err?.name || 'unknown error'}`);
      }
    }

    if (added.length > 0) {
      setItems((prev) => [...prev, ...added]);
      expandPath(parent);
      setActiveFileId(added[added.length - 1].id);
    }

    if (failed.length > 0) {
      setToast({
        type: 'error',
        text:
          (added.length > 0 ? `✓ ${added.length} The file has been added\n` : '') +
          `✕ This was not added:\n${failed.join('\n')}`
      });
    } else {
      setToast({ type: 'ok', text: `✓ ${added.length} The file has been added` });
    }
  };

  // ---------- Type in editor ----------

  const handleCodeChange = (newContent) => {
    const current = items.find((f) => f.id === activeFileId);
    if (!current) return;

    const updatedFile = { ...current, content: newContent };

    setItems((prev) => prev.map((f) => (f.id === activeFileId ? updatedFile : f)));
    saveFileDB(updatedFile);
  };

  return (
    <>  
      <div
        className="relative flex w-full overflow-hidden bg-slate-950"
        style={{ height: 'var(--app-h, 100dvh)' }}
      >

        <Sidebar
          isOpen={isOpen}
          toggleSidebar={toggleSidebar}
          items={items}
          expanded={expanded}
          activeFileId={activeFileId}
          onSelectFile={(file) => setActiveFileId(file.id)}
          onToggleFolder={handleToggleFolder}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
          onRename={handleRename}
          onMove={handleMove}
          onDelete={handleDelete}
          onDownload={handleDownload}
          onUploadFiles={handleUploadFiles}
        />

        <main className="flex-1 min-w-0 h-full overflow-hidden">
          {activeFile ? (
            <Editor
              activeFile={activeFile}
              files={files}
              onCodeChange={handleCodeChange}
              toggleSidebar={toggleSidebar}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center font-mono text-sm text-slate-500">
              <div>{loaded ? 'No file is open.' : 'Loading Editor...'}</div>
              {loaded && (
                <button
                  onClick={toggleSidebar}
                  className="h-9 rounded bg-slate-800 px-4 text-xs font-bold text-cyan-400 active:bg-slate-700"
                >
                  ☰ Open Explorer
                </button>
              )}
            </div>
          )}
        </main>

        {/* TOAST */}
        {toast && (
          <div
            onClick={() => setToast(null)}
            className={`fixed top-3 left-3 right-3 z-[80] mx-auto max-w-md whitespace-pre-line break-words rounded-lg px-3 py-2 text-xs font-mono text-white shadow-xl ${toast.type === 'error'
                ? 'bg-rose-600'
                : toast.type === 'ok'
                  ? 'bg-emerald-600'
                  : 'bg-slate-700'
              }`}
          >
            {toast.text}
          </div>
        )}
      </div>
    </>
  );
}