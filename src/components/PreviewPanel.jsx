import React, { useState, useEffect, useRef, useMemo } from 'react';
import ConsolePanel from './ConsolePanel';
import { compilePreview } from '../utils/compilePreview';
import { injectBridge, makeLog } from '../utils/consoleBridge';
import { getPageMeta } from '../utils/pageMeta';
import {
  IconTerminal,
  IconGlobe,
  IconClose,
  IconPhone,
  IconTablet,
  IconLaptop,
  IconCustomSize,
  IconFull,
  IconRotate
} from './Icons';

/* ---------- Responsive device presets ---------- */
const DEVICE_SIZES = {
  phone: { w: 375, h: 667 },
  tablet: { w: 768, h: 1024 },
  laptop: { w: 1280, h: 800 }
};

// Device buttons shown in the preview toolbar
const DEVICE_BUTTONS = [
  { id: 'full', label: 'Full', Icon: IconFull },
  { id: 'phone', label: 'Phone', Icon: IconPhone },
  { id: 'tablet', label: 'Tablet', Icon: IconTablet },
  { id: 'laptop', label: 'Laptop', Icon: IconLaptop },
  { id: 'custom', label: 'Custom', Icon: IconCustomSize }
];

// Keeps a custom size inside a sane range
const clampSize = (value, fallback) => {
  const n = parseInt(value, 10);
  if (!n) return fallback;
  return Math.min(4000, Math.max(100, n));
};

// Shows the page favicon, falls back to a globe icon if it is missing or broken
const Favicon = ({ src }) => {
  const [failed, setFailed] = useState(false);

  // Reset the error state whenever the favicon source changes
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return <IconGlobe className="h-4 w-4 flex-shrink-0 text-slate-400" />;
  }

  return (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className="h-4 w-4 flex-shrink-0 rounded-sm object-contain"
    />
  );
};

/**
 * Full-screen preview overlay: Web tab (with browser-like bar and responsive device toolbar)
 * and Console tab.
 * Logs live in the parent so the tools tray can show a badge.
 */
export default function PreviewPanel({
  activeFile,
  files,
  activeTab,
  setActiveTab,
  logs,
  setLogs,
  onClose
}) {
  const iframeRef = useRef(null);
  const stageRef = useRef(null);

  // Responsive preview state
  const [device, setDevice] = useState('full');
  const [landscape, setLandscape] = useState(false);
  const [customSize, setCustomSize] = useState({ w: '420', h: '700' });
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  // Build the preview HTML once per change (and inject the console bridge)
  const previewCode = useMemo(
    () => injectBridge(compilePreview(activeFile, files)),
    [activeFile, files]
  );

  // Title and favicon shown in the browser-like bar
  const pageMeta = useMemo(() => getPageMeta(previewCode, files), [previewCode, files]);

  // Fake address shown in the bar (the preview actually runs inside a srcDoc iframe)
  const addressText = `localhost/${(activeFile?.path || 'index.html').replace(/^\//, '')}`;

  // Collect console logs (and command results) coming from the preview iframe
  useEffect(() => {
    const handleMessage = (event) => {
      if (
        !iframeRef.current ||
        event.source !== iframeRef.current.contentWindow ||
        event.data?.type !== 'DEVTOOLS_LOG'
      ) {
        return;
      }

      // console.clear() / clear() called from inside the page or the bridge
      if (event.data.level === 'clear') {
        setLogs([]);
        return;
      }

      const { level, message, value } = event.data;
      setLogs((prev) => [...prev.slice(-499), makeLog(level, message, value)]);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setLogs]);

  // Measure the preview stage so device frames can be scaled to fit the screen
  useEffect(() => {
    if (!stageRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      // Ignore zero sizes (the stage is hidden while the Console tab is active)
      if (rect.width > 0 && rect.height > 0) {
        setStageSize({ w: rect.width, h: rect.height });
      }
    });

    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  /* ---------- Responsive preview sizing ---------- */
  // Size of the simulated device screen (null means the preview fills the whole area)
  const deviceDims = useMemo(() => {
    if (device === 'full') return null;

    const base =
      device === 'custom'
        ? { w: clampSize(customSize.w, 420), h: clampSize(customSize.h, 700) }
        : DEVICE_SIZES[device];

    return landscape ? { w: base.h, h: base.w } : base;
  }, [device, landscape, customSize]);

  // Scale the device frame down so it always fits inside the available area
  const frameScale = deviceDims
    ? Math.max(
        0.1,
        Math.min(
          1,
          stageSize.w > 0 ? stageSize.w / deviceDims.w : 1,
          stageSize.h > 0 ? stageSize.h / deviceDims.h : 1
        )
      )
    : 1;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-slate-950">
      {/* TAB BAR */}
      <div className="flex h-11 flex-shrink-0 items-center justify-between px-3 border-b border-slate-800 bg-slate-900 select-none">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold transition-all ${activeTab === 'preview' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400'
              }`}
          >
            <IconGlobe className="h-3.5 w-3.5" />
            Web
          </button>

          <button
            onClick={() => setActiveTab('console')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold transition-all ${activeTab === 'console' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-400'
              }`}
          >
            <IconTerminal className="h-3.5 w-3.5" />
            Console
            {logs.length > 0 && (
              <span className="px-1.5 rounded-full bg-slate-900 text-amber-400 text-[10px] font-bold">
                {logs.length}
              </span>
            )}
          </button>
        </div>

        <button
          onClick={onClose}
          className="flex h-8 items-center gap-1.5 px-3 rounded bg-rose-600/20 text-rose-400 font-mono text-xs border border-rose-500/30 active:scale-95"
        >
          <IconClose className="h-3.5 w-3.5" />
          Close
        </button>
      </div>

      <div className="flex-1 min-h-0 w-full relative overflow-hidden bg-black">
        {/* WEB TAB: browser-like bar + responsive toolbar + preview stage */}
        <div className={`h-full w-full flex-col ${activeTab === 'preview' ? 'flex' : 'hidden'}`}>
          {/* Browser-like bar: favicon, title and URL */}
          <div className="flex-shrink-0 border-b border-slate-800 bg-slate-900 px-2 py-1.5 select-none">
            <div className="flex min-w-0 items-center gap-2">
              <Favicon src={pageMeta.favicon} />
              <span className="truncate text-xs font-semibold text-slate-200">
                {pageMeta.title}
              </span>
            </div>

            <div className="mt-1.5 flex h-7 min-w-0 items-center gap-1.5 rounded-full border border-slate-800 bg-slate-950 px-3">
              <IconGlobe className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
              <span className="truncate font-mono text-[11px] text-slate-400">{addressText}</span>
            </div>
          </div>

          {/* Responsive (device) toolbar */}
          <div className="flex h-10 flex-shrink-0 items-center gap-1.5 overflow-x-auto scrollbar-none border-b border-slate-800 bg-slate-900 px-2 select-none">
            {DEVICE_BUTTONS.map(({ id, label, Icon: DeviceIcon }) => (
              <button
                key={id}
                title={label}
                onClick={() => setDevice(id)}
                className={`flex h-7 flex-shrink-0 items-center gap-1 rounded border px-2 text-[11px] font-mono font-semibold active:scale-95 ${device === id
                    ? 'border-cyan-500 bg-cyan-500 text-slate-950'
                    : 'border-slate-700 bg-slate-800 text-slate-300'
                  }`}
              >
                <DeviceIcon className="h-4 w-4" />
                {label}
              </button>
            ))}

            {deviceDims && (
              <button
                title="Rotate"
                onClick={() => setLandscape((l) => !l)}
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border active:scale-95 ${landscape
                    ? 'border-amber-400 bg-amber-400 text-slate-950'
                    : 'border-slate-700 bg-slate-800 text-slate-300'
                  }`}
              >
                <IconRotate className="h-4 w-4" />
              </button>
            )}

            {device === 'custom' && (
              <div className="flex flex-shrink-0 items-center gap-1 font-mono text-slate-400">
                <input
                  type="number"
                  inputMode="numeric"
                  value={customSize.w}
                  onChange={(e) => setCustomSize((s) => ({ ...s, w: e.target.value }))}
                  onBlur={() => setCustomSize((s) => ({ ...s, w: String(clampSize(s.w, 420)) }))}
                  className="h-7 w-16 rounded border border-slate-700 bg-slate-950 px-1.5 text-center text-[16px] text-cyan-300 outline-none focus:border-cyan-500"
                />
                <span className="text-xs">x</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={customSize.h}
                  onChange={(e) => setCustomSize((s) => ({ ...s, h: e.target.value }))}
                  onBlur={() => setCustomSize((s) => ({ ...s, h: String(clampSize(s.h, 700)) }))}
                  className="h-7 w-16 rounded border border-slate-700 bg-slate-950 px-1.5 text-center text-[16px] text-cyan-300 outline-none focus:border-cyan-500"
                />
              </div>
            )}

            {deviceDims && (
              <span className="ml-auto flex-shrink-0 pl-2 text-[10px] font-mono text-slate-500">
                {deviceDims.w} x {deviceDims.h} ({Math.round(frameScale * 100)}%)
              </span>
            )}
          </div>

          {/* Preview stage. The same iframe element is always kept so it never reloads when the device changes */}
          <div
            ref={stageRef}
            className={`flex min-h-0 flex-1 justify-center overflow-auto ${deviceDims ? 'items-start bg-slate-900 p-2' : 'bg-white'
              }`}
          >
            <div
              className={`flex-shrink-0 bg-white ${deviceDims ? 'shadow-lg ring-1 ring-slate-600' : ''}`}
              style={
                deviceDims
                  ? { width: deviceDims.w * frameScale, height: deviceDims.h * frameScale }
                  : { width: '100%', height: '100%' }
              }
            >
              <iframe
                ref={iframeRef}
                srcDoc={previewCode}
                title="live-output"
                sandbox="allow-scripts"
                className="block border-none bg-white"
                style={
                  deviceDims
                    ? {
                        width: deviceDims.w,
                        height: deviceDims.h,
                        transform: `scale(${frameScale})`,
                        transformOrigin: 'top left'
                      }
                    : { width: '100%', height: '100%' }
                }
              />
            </div>
          </div>
        </div>

        {/* CONSOLE TAB (stays mounted so input, history and filters are kept) */}
        <ConsolePanel
          visible={activeTab === 'console'}
          iframeRef={iframeRef}
          logs={logs}
          setLogs={setLogs}
        />
      </div>
    </div>
  );
}