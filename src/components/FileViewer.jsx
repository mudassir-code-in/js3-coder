import React, { useState, useEffect, useMemo } from 'react';
import ImageViewer from './ImageViewer';
import { getKind, getBadge } from '../utils/templates';
import { formatBytes, dataURLToBlob } from '../utils/files';

export default function FileViewer({ file }) {
  const kind = getKind(file);

  if (kind === 'image') return <ImageViewer file={file} />;
  return <BlobViewer file={file} kind={kind} />;
}

function BlobViewer({ file, kind }) {
  const blob = useMemo(() => dataURLToBlob(file.content), [file.id, file.content]);
  const [url, setUrl] = useState('');

  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  const size = file.size ?? blob.size;
  const badge = getBadge(file.name);


  const shareFile = useMemo(() => {
    try {
      const f = new File([blob], file.name, { type: blob.type });
      return navigator.canShare?.({ files: [f] }) ? f : null;
    } catch {
      return null;
    }
  }, [blob, file.name]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    try {
      await navigator.share({ files: [shareFile], title: file.name });
    } catch {
      /* user canceled*/
    }
  };

  const btn =
    'h-8 px-3 rounded bg-slate-800 text-cyan-400 text-xs font-mono font-bold active:bg-slate-700';

  return (
    <div className="flex h-full w-full flex-col bg-[#1e1e1e]">
      {/* INFO BAR */}
      <div className="flex h-10 flex-shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 text-[11px] font-mono text-slate-400">
        <span className="truncate">
          {badge.label} · {formatBytes(size)}
        </span>

        <div className="flex flex-shrink-0 items-center gap-1.5">
          {kind === 'pdf' && url && (
            <button onClick={() => window.open(url, '_blank')} className={btn}>
              ↗ Open
            </button>
          )}
          {shareFile && (
            <button onClick={handleShare} className={btn}>
              Share
            </button>
          )}
          <button onClick={handleDownload} className={btn}>
             Save
          </button>
        </div>
      </div>

      {/* BODY */}
      <div className="min-h-0 flex-1 overflow-auto">
        {kind === 'pdf' && url && (
          <div className="flex h-full flex-col">
            <iframe src={url} title={file.name} className="min-h-0 w-full flex-1 border-none bg-white" />
            <p className="flex-shrink-0 bg-slate-900 px-3 py-1.5 text-center text-[10px] text-slate-500">
              If the PDF doesn't appear on your phone, tap 'Open' at the top.
            </p>
          </div>
        )}

        {kind === 'audio' && url && (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
            <div className="text-5xl">🎵</div>
            <div className="max-w-full truncate text-sm font-mono text-slate-300">{file.name}</div>
            <audio controls src={url} className="w-full max-w-md" />
          </div>
        )}

        {kind === 'video' && url && (
          <div className="flex h-full items-center justify-center bg-black">
            <video controls playsInline src={url} className="max-h-full max-w-full" />
          </div>
        )}

        {kind === 'binary' && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <div className={`text-4xl font-mono font-bold ${badge.color}`}>{badge.label}</div>
            <div className="max-w-full break-all text-sm font-mono text-slate-200">{file.name}</div>
            <div className="text-xs font-mono text-slate-500">
              {file.mime || blob.type || 'unknown type'} · {formatBytes(size)}
            </div>
            <p className="max-w-xs text-xs leading-relaxed text-slate-500">
              A preview of this file cannot be generated within the app. Save or share the file, then open it using another app on your phone (such as Word, Excel, WPS, Drive, etc.).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}