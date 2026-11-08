import React, { useState, useEffect, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import FileViewer from './FileViewer';
import PreviewPanel from './PreviewPanel';
import { getLanguage, getKind, isEditable } from '../utils/templates';
import { setupHtmlCompletions } from '../utils/htmlCompletions';
import Header from './Header';
import {
  IconExplorer,
  IconPlay,
  IconUndo,
  IconTrash,
  IconKeyboard,
  IconTerminal,
  IconGrid,
  IconChevronDown
} from './Icons';

const SYMBOLS = ['<', '>', '/', '=', '"', "'", '-', '{', '}', '(', ')', '[', ']', ';', ':'];
const TRIGGER_CHARS = ['<', '/', '.', '-', '"', "'", ':', '='];

// Keeps the editor focused (and the keyboard open) when a toolbar button is pressed
const keepFocus = (e) => e.preventDefault();

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
            className={`absolute inset-x-0 bottom-full z-30 border-t border-slate-800 bg-slate-900 p-2 shadow-[0_-8px_24px_rgba(0,0,0,0.45)] transition-all duration-200 ease-out ${toolsOpen
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
              className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border active:scale-95 transition-all ${toolsOpen
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

        {/* PREVIEW / CONSOLE OVERLAY (separate component) */}
        {showPreview && (
          <PreviewPanel
            activeFile={activeFile}
            files={files}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            logs={logs}
            setLogs={setLogs}
            onClose={() => setShowPreview(false)}
          />
        )}
      </div>
    </>
  );
}