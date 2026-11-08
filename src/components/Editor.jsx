import React, { useState, useEffect, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import FileViewer from './FileViewer';
import { getLanguage, getKind, isEditable } from '../utils/templates';
import { compilePreview } from '../utils/compilePreview';
import { setupHtmlCompletions } from '../utils/htmlCompletions';
import Header from './Header';

const SYMBOLS = ['<', '>', '/', '=', '"', "'", '-', '{', '}', '(', ')', '[', ']', ';', ':'];
const TRIGGER_CHARS = ['<', '/', '.', '-', '"', "'", ':', '='];

const keepFocus = (e) => e.preventDefault();

export default function Editor({ activeFile, files, onCodeChange, toggleSidebar }) {
  const editorRef = useRef(null);
  const iframeRef = useRef(null);
  const suggestTimerRef = useRef(null);

  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState('preview');
  const [logs, setLogs] = useState([]);

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

  // Preview frame ke console messages sunna
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

 
  useEffect(() => {
    return () => clearTimeout(suggestTimerRef.current);
  }, []);

  const handleBeforeMount = (monaco) => {
    setupHtmlCompletions(monaco);
  };

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
    applyKeyboardMode(screenKeyboardRef.current, false);

    editor.onDidChangeModelContent((e) => {
      const change = e.changes[0];
      if (!change || e.isFlush) return;

      // Letters par Monaco ka quickSuggestions khud suggest kholta hai.
      // Sirf special chars par manual trigger, debounce ke saath (widget restart/flicker nahi hoga).
      if (change.text.length === 1 && /[<\/\-.:="' ]/.test(change.text)) {
        clearTimeout(suggestTimerRef.current);
        suggestTimerRef.current = setTimeout(() => {
          editor.trigger('auto', 'editor.action.triggerSuggest', {});
        }, 30);
      }
    });
  };

  const handleUndo = () => {
    if (editorRef.current) {
      editorRef.current.trigger('keyboard', 'undo', null);
      editorRef.current.focus();
    }
  };

  const handleClearCode = () => {
    if (editorRef.current) {
      editorRef.current.setValue('');
      editorRef.current.focus();
    }
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

  const previewCode = showPreview ? compilePreview(activeFile, files) : '';

  return (
    <>
      <div
        className="flex w-full flex-col bg-slate-950 overflow-hidden relative"
        style={{ height: vh ? `${vh}px` : '100%' }}
      >
        <Header />

        {/* TOP BAR */}
        <div className="flex h-8 w-full flex-shrink-0 items-center justify-between gap-2 px-2 border-b border-slate-800 bg-slate-900/90 z-20 select-none">
          <div className="flex items-center min-w-0 gap-2">
            <button
              onClick={toggleSidebar}
              title="Explorer"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-slate-800 text-cyan-400 border border-slate-700 text-sm active:scale-95 sm:hidden"
            >
              📂
            </button>

            <span className="text-xs font-mono text-cyan-400 font-semibold truncate">
              {activeFile ? activeFile.path : 'index.html'}
            </span>
          </div>

          <button
            onClick={() => openPanel('preview')}
            className="flex h-7 items-center px-1 mx-2 rounded bg-green-400 text-slate-950 font-mono text-xs font-bold active:scale-95"
          >
            <span>RUN 🕹️</span>
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
          className="flex min-h-[56px] w-full flex-shrink-0 items-center justify-between gap-2 border-t border-slate-800 bg-slate-900 px-3 select-none"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1 py-1">
            {editable ? (
              SYMBOLS.map((char) => (
                <button
                  key={char}
                  onMouseDown={keepFocus}
                  onClick={() => insertTextAtCursor(char)}
                  className="flex h-9 min-w-[36px] items-center justify-center rounded-md font-mono text-xs font-bold bg-slate-800 text-cyan-400 border border-slate-700/80 active:scale-95 transition-all"
                >
                  {char}
                </button>
              ))
            ) : (
              <span className="text-[11px] font-mono text-slate-500 truncate">
                {kind} file (sirf dekhne ke liye)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0 pl-2 border-l border-slate-800">
            {editable && (
              <>
                <button
                  onMouseDown={keepFocus}
                  onClick={handleUndo}
                  className="flex h-9 w-9 items-center justify-center rounded-md bg-purple-600/20 text-purple-300 border border-purple-500/40 active:scale-95 transition-all"
                >
                  ↩️
                </button>

                <button
                  onMouseDown={keepFocus}
                  onClick={handleClearCode}
                  className="flex h-9 w-9 items-center justify-center rounded-md bg-rose-600/20 text-rose-300 border border-rose-500/40 active:scale-95 transition-all"
                >
                  🗑️
                </button>

                <button
                  onMouseDown={keepFocus}
                  onClick={toggleScreenKeyboard}
                  title={screenKeyboard ? 'Screen keyboard ON' : 'Screen keyboard OFF (physical keyboard)'}
                  className={`flex h-9 min-w-[36px] items-center justify-center rounded-md border px-1.5 text-xs font-bold active:scale-95 transition-all ${
                    screenKeyboard
                      ? 'bg-slate-800 text-slate-300 border-slate-700'
                      : 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  ⌨️{screenKeyboard ? '' : '✕'}
                </button>
              </>
            )}

            <button
              onClick={() => openPanel('console')}
              className="flex h-9 items-center gap-1 px-2.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold active:scale-95 transition-all"
            >
              <span>💻</span>
              {logs.length > 0 && (
                <span className="px-1.5 text-[10px] rounded-full bg-amber-400 text-slate-950 font-bold">
                  {logs.length}
                </span>
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
                  className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-all ${
                    activeTab === 'preview' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400'
                  }`}
                >
                  🌐 Web
                </button>

                <button
                  onClick={() => setActiveTab('console')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold transition-all ${
                    activeTab === 'console' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-400'
                  }`}
                >
                  💻 Console
                  {logs.length > 0 && (
                    <span className="px-1.5 rounded-full bg-slate-900 text-amber-400 text-[10px] font-bold">
                      {logs.length}
                    </span>
                  )}
                </button>
              </div>

              <button
                onClick={() => setShowPreview(false)}
                className="h-8 px-3 rounded bg-rose-600/20 text-rose-400 font-mono text-xs border border-rose-500/30"
              >
                ✕ Close
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
                    className="px-2 py-1 rounded bg-[#333333] text-[#cccccc] text-[10px]"
                  >
                    🚫 Clear
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