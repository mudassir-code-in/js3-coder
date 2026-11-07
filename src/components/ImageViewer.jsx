import React, { useState, useEffect } from 'react';
import { formatBytes } from '../utils/files';

const checker = {
  backgroundColor: '#1e1e1e',
  backgroundImage:
    'linear-gradient(45deg,#2a2a2a 25%,transparent 25%),' +
    'linear-gradient(-45deg,#2a2a2a 25%,transparent 25%),' +
    'linear-gradient(45deg,transparent 75%,#2a2a2a 75%),' +
    'linear-gradient(-45deg,transparent 75%,#2a2a2a 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0'
};

export default function ImageViewer({ file }) {
  const [dims, setDims] = useState(null);
  const [fit, setFit] = useState(true);

  useEffect(() => {
    setDims(null);
    setFit(true);
  }, [file.id]);

  const size = file.size ?? Math.round((file.content.length * 3) / 4);

  return (
    <div className="flex h-full w-full flex-col bg-[#1e1e1e]">
      <div className="flex h-9 flex-shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 text-[11px] font-mono text-slate-400">
        <span className="truncate">
          {dims ? `${dims.w} × ${dims.h}` : '...'} · {formatBytes(size)}
        </span>

        <button
          onClick={() => setFit((f) => !f)}
          className="h-7 px-3 rounded bg-slate-800 text-cyan-400 font-bold active:bg-slate-700"
        >
          {fit ? 'Fit' : '100%'}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 overflow-auto p-3" style={checker}>
        <img
          src={file.content}
          alt={file.name}
          draggable={false}
          onLoad={(e) =>
            setDims({ w: e.target.naturalWidth, h: e.target.naturalHeight })
          }
          className={`m-auto ${fit ? 'max-h-full max-w-full object-contain' : 'max-w-none'}`}
        />
      </div>
    </div>
  );
}