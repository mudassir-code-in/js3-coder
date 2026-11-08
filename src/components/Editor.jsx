import React, { useState, useEffect, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import FileViewer from './FileViewer';
import { getLanguage, getKind, isEditable } from '../utils/templates';
import { compilePreview } from '../utils/compilePreview';
import { setupHtmlCompletions } from '../utils/htmlCompletions';
import Header from './Header';

const SYMBOLS = ['<', '>', '/', '=', '"', "'", '-', '{', '}', '(', ')', '[', ']', ';', ':'];
const TRIGGER_CHARS = ['<', '/', '.', '-', '"', "'", ':', '='];

// Keeps the editor focused (and the keyboard open) when a toolbar button is pressed
const keepFocus = (e) => e.preventDefault();

/* ---------- Icons (24x24, stroke based) ---------- */
const Icon = ({ children, className = 'h-5 w-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

const IconExplorer = ({ className }) => (
  <Icon className={className}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </Icon>
);

const IconPlay = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className || 'h-4 w-4'} aria-hidden="true">
    <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" />
  </svg>
);

const IconUndo = ({ className }) => (
  <Icon className={className}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Icon>
);

const IconTrash = ({ className }) => (
  <Icon className={className}>
    <path d="M3 6h18" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </Icon>
);

const IconKeyboard = ({ className, off }) => (
  <Icon className={className}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
    {off && <path d="M3 3l18 18" />}
  </Icon>
);

const IconTerminal = ({ className }) => (
  <Icon className={className}>
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </Icon>
);

const IconGlobe = ({ className }) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </Icon>
);

const IconClose = ({ className }) => (
  <Icon className={className}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
);

const IconClear = ({ className }) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="m4.9 4.9 14.2 14.2" />
  </Icon>
);

const IconGrid = ({ className }) => (
  <Icon className={className}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </Icon>
);

const IconChevronDown = ({ className }) => (
  <Icon className={className}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

/* ---------- Tool tile used inside the slide-up tray ---------- */
const TONES = {
  slate: 'bg-slate-800 text-slate-200 border-slate-700',
  purple: 'bg-purple-600/15 text-purple-300 border-purple-500/40',
  rose: 'bg-rose-600/15 text-rose-300 border-rose-500/40',
  emerald: 'bg-emerald-600/15 text-emerald-300 border-emerald-500/40',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/40'
};

const ToolTile = ({ icon, label, tone = 'slate', badge, onClick }) => (
  <button
    onMouseDown={keepFocus}
    onClick={onClick}
    className={`relative flex h-16 flex-1 flex-col items-center justify-center gap-1 rounded-lg border text-[11px] font-semibold active:scale-95 transition-transform ${TONES[tone]}`}
  >
    {icon}
    <span className="leading-none">{label}</span>
    {badge > 0 && (
      <span className="absolute right-1.5 top-1 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold leading-4 text-slate-950">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
);

export default function Editor({ activeFile, files, onCodeChange, toggleSidebar }) {
  const editorRef = useRef(null);
  const iframeRef = useRef(null);
  const suggestTimerRef = useRef(null);

  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState('preview');
  const [logs, setLogs] = useState([]);
  const [toolsOpen, setToolsOpen] = useState(false);

  const [screenKeyboard, setScreenKeyboard] = useState(true);
  const screenKeyboardRef = useRef(true);

  const [vh, setVh] = useState(null);

  const editable = isEditable(activeFile);
  const kind = getKind(activeFile);

  const getInputEl = () =>
    editorRef.current?.getDomNode?.()?.querySelector('.native-edit-context, textarea') || null;

  const applyKeyboardMode = (on, refocus) => {
    const el = getInputEl();
    if (!el) return;
    el.setAttribute('inputmode', on ? 'text' : 'none');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('spellcheck', 'false');
    if (refocus && document.activeElement === el) {
      el.blur();
      setTimeout(() => el.focus({ preventScroll: true }), 60);
    }
  };

  const toggleScreenKeyboard = () => {
    const next = !screenKeyboardRef.current;
    screenKeyboardRef.current = next;
    setScreenKeyboard(next);
    applyKeyboardMode(next, true);
  };

  // Track the visual viewport so the layout shrinks when the on-screen keyboard opens
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      setVh(Math.round(vv.height));
      window.scrollTo(0, 0);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  // Collect console logs coming from the preview iframe
  useEffect(() => {
    const handleMessage = (event) => {
      if (
        !iframeRef.current ||
        event.source !== iframeRef.current.contentWindow ||
        event.data?.type !== 'DEVTOOLS_LOG'
      ) {
        return;
      }

      setLogs((prev) => [
        ...prev.slice(-499),
        {
          id: Date.now() + Math.random(),
          level: event.data.level,
          message: event.data.message,
          time: new Date().toLocaleTimeString('en-US', { hour12: false })
        }
      ]);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Pending suggest timer cleanup
  useEffect(() => {
    return () => clearTimeout(suggestTimerRef.current);
  }, []);

  // Close the tools tray when another file is opened
  useEffect(() => {
    setToolsOpen(false);
  }, [activeFile?.id]);

  const handleBeforeMount = (monaco) => {
    setupHtmlCompletions(monaco);
  };

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
    applyKeyboardMode(screenKeyboardRef.current, false);

    editor.onDidChangeModelContent((e) => {
      const change = e.changes[0];
      if (!change || e.isFlush) return;

      // Re-trigger suggestions quickly after every typed character
      if (change.text.length === 1 && /[\w<\/\-.:="' ]/.test(change.text)) {
        clearTimeout(suggestTimerRef.current);
        suggestTimerRef.current = setTimeout(() => {
          editor.trigger('auto', 'editor.action.triggerSuggest', {});
        }, 20);
      }
    });
  };

  const handleUndo = () => {
    if (editorRef.current) {
      editorRef.current.trigger('keyboard', 'undo', null);
      editorRef.current.focus();
    }
  };

  // Clears the file through an edit operation so Undo can bring the code back
  const handleClearCode = () => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) return;

    editor.pushUndoStop();
    editor.executeEdits('clear', [{ range: model.getFullModelRange(), text: '' }]);
    editor.pushUndoStop();
    editor.focus();
  };

  const insertTextAtCursor = (text) => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const selection = editor.getSelection();
    if (!selection) return;

    editor.executeEdits('quick-bar', [{ range: selection, text, forceMoveMarkers: true }]);
    editor.focus();

    if (TRIGGER_CHARS.includes(text)) {
      setTimeout(() => editor.trigger('quick-bar', 'editor.action.triggerSuggest', {}), 0);
    }
  };

  const openPanel = (tab) => {
    if (tab === 'preview') setLogs([]);
    setActiveTab(tab);
    setShowPreview(true);
  };

  // Runs a tray action and slides the tray back down
  const useTool = (fn) => () => {
    fn();
    setToolsOpen(false);
  };

  const previewCode = showPreview ? compilePreview(activeFile, files) : '';

  return (
    <>
      <div
        className="flex w-full flex-col bg-slate-950 overflow-hidden relative"
        style={{ height: vh ? `${vh}px` : '100%' }}
      >
        <Header />

        {/* TOP BAR */}
        <div className="flex h-9 w-full flex-shrink-0 items-center justify-between gap-2 px-2 border-b border-slate-800 bg-slate-900/90 z-20 select-none">
          <div className="flex items-center min-w-0 gap-2">
            <button
              onClick={toggleSidebar}
              title="Explorer"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-slate-800 text-cyan-400 border border-slate-700 active:scale-95 sm:hidden"
            >
              <IconExplorer className="h-4 w-4" />
            </button>

            <span className="text-xs font-mono text-cyan-400 font-semibold truncate">
              {activeFile ? activeFile.path : 'index.html'}
            </span>
          </div>

          <button
            onClick={() => openPanel('preview')}
            className="flex h-7 flex-shrink-0 items-center gap-1.5 px-3 rounded-md bg-green-400 text-slate-950 font-mono text-xs font-bold tracking-wider active:scale-95 transition-transform"
          >
            <IconPlay />
            RUN
          </button>
        </div>

        {/* EDITOR / FILE VIEWER */}
        <div className="flex-1 min-h-0 w-full relative overflow-hidden">
          {!editable && activeFile ? (
            <FileViewer file={activeFile} />
          ) : (
            activeFile && (
              <MonacoEditor
                key={activeFile.id}
                height="100%"
                width="100%"
                language={getLanguage(activeFile.name)}
                defaultValue={activeFile.content}
                theme="vs-dark"
                beforeMount={handleBeforeMount}
                onMount={handleEditorDidMount}
                onChange={(val) => onCodeChange(val ?? '')}
                loading={
                  <div className="flex h-full w-full items-center justify-center text-sm font-mono text-cyan-400 bg-slate-950">
                    Editor Loading...
                  </div>
                }
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  wordWrap: 'on',
                  lineNumbersMinChars: 3,
                  glyphMargin: false,
                  folding: true,
                  tabSize: 2,
                  automaticLayout: true,
                  scrollBeyondLastLine: false,

                  editContext: true,

                  quickSuggestions: { other: true, comments: false, strings: true },
                  quickSuggestionsDelay: 0,
                  suggestOnTriggerCharacters: true,
                  acceptSuggestionOnEnter: 'on',
                  acceptSuggestionOnCommitCharacter: false,
                  tabCompletion: 'on',
                  suggestSelection: 'first',
                  wordBasedSuggestions: 'off',
                  suggest: {
                    showWords: false,
                    preview: false,
                    snippetsPreventQuickSuggestions: false
                  },
                  parameterHints: { enabled: true },

                  autoClosingBrackets: 'always',
                  autoClosingQuotes: 'always',
                  autoClosingTags: true,
                  autoIndent: 'full',
                  formatOnPaste: true,
                  formatOnType: false,

                  renderWhitespace: 'none',
                  renderLineHighlight: 'none',
                  occurrencesHighlight: 'off',
                  selectionHighlight: false,
                  matchBrackets: 'never'
                }}
              />
            )
          )}
        </div>

        {/* BOTTOM BAR */}
        <div
          className="relative w-full flex-shrink-0 border-t border-slate-800 bg-slate-900 select-none"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* TOOLS TRAY (slides up above the bar) */}
          <div
            className={`absolute inset-x-0 bottom-full z-30 border-t border-slate-800 bg-slate-900 p-2 shadow-[0_-8px_24px_rgba(0,0,0,0.45)] transition-all duration-200 ease-out ${
              toolsOpen
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none translate-y-3 opacity-0'
            }`}
          >
            <div className="flex gap-2">
              {editable && (
                <>
                  <ToolTile
                    tone="purple"
                    label="Undo"
                    icon={<IconUndo />}
                    onClick={useTool(handleUndo)}
                  />
                  <ToolTile
                    tone="rose"
                    label="Clear"
                    icon={<IconTrash />}
                    onClick={useTool(handleClearCode)}
                  />
                  <ToolTile
                    tone={screenKeyboard ? 'slate' : 'emerald'}
                    label={screenKeyboard ? 'Keyboard' : 'Kbd off'}
                    icon={<IconKeyboard off={!screenKeyboard} />}
                    onClick={useTool(toggleScreenKeyboard)}
                  />
                </>
              )}

              <ToolTile
                tone="amber"
                label="Console"
                badge={logs.length}
                icon={<IconTerminal />}
                onClick={useTool(() => openPanel('console'))}
              />
            </div>
          </div>

          {/* SYMBOL ROW + TOOLS BUTTON */}
          <div className="flex min-h-[56px] items-center gap-2 px-2">
            <div className="flex flex-1 items-center gap-1.5 overflow-x-auto scrollbar-none py-1.5">
              {editable ? (
                SYMBOLS.map((char) => (
                  <button
                    key={char}
                    onMouseDown={keepFocus}
                    onClick={() => insertTextAtCursor(char)}
                    className="flex h-10 min-w-[42px] flex-shrink-0 items-center justify-center rounded-md border border-slate-700/80 bg-slate-800 font-mono text-base font-bold text-cyan-400 active:scale-95 active:bg-slate-700 transition-transform"
                  >
                    {char}
                  </button>
                ))
              ) : (
                <span className="px-1 text-[11px] font-mono text-slate-500 truncate">{kind}</span>
              )}
            </div>

            <button
              onMouseDown={keepFocus}
              onClick={() => setToolsOpen((o) => !o)}
              title="Tools"
              className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border active:scale-95 transition-all ${
                toolsOpen
                  ? 'border-cyan-500 bg-cyan-500 text-slate-950'
                  : 'border-slate-700 bg-slate-800 text-slate-300'
              }`}
            >
              {toolsOpen ? <IconChevronDown /> : <IconGrid />}
              {!toolsOpen && logs.length > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-400" />
              )}
            </button>
          </div>
        </div>

        {/* PREVIEW / CONSOLE OVERLAY */}
        {showPreview && (
          <div className="absolute inset-0 z-50 flex flex-col bg-slate-950">
            <div className="flex h-11 flex-shrink-0 items-center justify-between px-3 border-b border-slate-800 bg-slate-900 select-none">
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold transition-all ${
                    activeTab === 'preview' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400'
                  }`}
                >
                  <IconGlobe className="h-3.5 w-3.5" />
                  Web
                </button>

                <button
                  onClick={() => setActiveTab('console')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold transition-all ${
                    activeTab === 'console' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-400'
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
                onClick={() => setShowPreview(false)}
                className="flex h-8 items-center gap-1.5 px-3 rounded bg-rose-600/20 text-rose-400 font-mono text-xs border border-rose-500/30 active:scale-95"
              >
                <IconClose className="h-3.5 w-3.5" />
                Close
              </button>
            </div>

            <div className="flex-1 min-h-0 w-full relative overflow-hidden bg-black">
              <div className={`w-full h-full bg-white ${activeTab === 'preview' ? 'block' : 'hidden'}`}>
                <iframe
                  ref={iframeRef}
                  srcDoc={previewCode}
                  title="live-output"
                  sandbox="allow-scripts"
                  className="w-full h-full border-none"
                />
              </div>

              <div
                className={`w-full h-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs flex-col ${
                  activeTab === 'console' ? 'flex' : 'hidden'
                }`}
              >
                <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-[#333333] text-[11px] text-[#cccccc]">
                  <span>Live Console ({logs.length})</span>
                  <button
                    onClick={() => setLogs([])}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[#333333] text-[#cccccc] text-[10px] active:bg-[#444444]"
                  >
                    <IconClear className="h-3 w-3" />
                    Clear
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                  {logs.length === 0 ? (
                    <div className="text-[#666666] italic p-4 text-center">Console is empty.</div>
                  ) : (
                    logs.map((log) => (
                      <div
                        key={log.id}
                        className={`flex items-start gap-2 px-2 py-1 border-b border-[#2d2d2d] leading-relaxed break-all ${
                          log.level === 'error'
                            ? 'bg-[#291415] text-[#f87171]'
                            : log.level === 'warn'
                            ? 'bg-[#2a2310] text-[#fbbf24]'
                            : 'text-[#4ec9b0]'
                        }`}
                      >
                        <span className="text-[#666666] text-[10px]">{log.time}</span>
                        <pre className="flex-1 whitespace-pre-wrap font-mono text-xs">{log.message}</pre>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}