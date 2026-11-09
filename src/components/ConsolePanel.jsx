import React, { useState, useEffect, useRef, useMemo } from 'react';
import ConsoleValue from './ConsoleValue';
import ElementsPanel from './ElementsPanel';
import { CLEAR_COMMAND, makeLog } from '../utils/consoleBridge';
import { IconClear, IconChevronDown } from './Icons';

// Filter chips shown at the top of the console
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'error', label: 'Errors' },
  { id: 'warn', label: 'Warnings' },
  { id: 'info', label: 'Info' },
  { id: 'log', label: 'Logs' }
];

// Row colors per log level (similar to Chrome DevTools dark theme)
const ROW_STYLES = {
  error: 'bg-[#290000] border-[#5c0000] text-[#ff8080]',
  warn: 'bg-[#332b00] border-[#5c4b00] text-[#f4bd00]',
  default: 'border-[#2d2d2d] text-[#d4d4d4]'
};

// Maps any log level to one of the filter categories
const categoryOf = (level) => (['error', 'warn', 'info'].includes(level) ? level : 'log');

// Keeps focus in the prompt when a helper button is pressed
const keepFocus = (e) => e.preventDefault();

// Used only to syntax-check the typed code (it is compiled, never run, in this window)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

// True when the code ends too early (open bracket, string, block...), so Enter should add a new line
const isIncomplete = (code) => {
  if (!code.trim()) return false;
  try {
    // eslint-disable-next-line no-new
    new AsyncFunction(code);
    return false;
  } catch (err) {
    return /end of input|end of script|EOF|Unterminated template|missing \) after/i.test(
      String(err && err.message)
    );
  }
};

const ErrorIcon = () => (
  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[#ff5555]" aria-hidden="true">
    <circle cx="8" cy="8" r="7" fill="currentColor" />
    <path d="M5.2 5.2l5.6 5.6M10.8 5.2l-5.6 5.6" stroke="#290000" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const WarnIcon = () => (
  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[#f4bd00]" aria-hidden="true">
    <path d="M8 1.5l7 12.5H1z" fill="currentColor" />
    <path d="M8 6v3.6M8 11.4v.2" stroke="#332b00" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

// Left gutter symbol of a row
const Gutter = ({ level }) => {
  if (level === 'error') return <ErrorIcon />;
  if (level === 'warn') return <WarnIcon />;
  if (level === 'input') return <span className="font-bold text-[#5ab0ff]">{'>'}</span>;
  if (level === 'result') return <span className="text-[#888]">{'<'}</span>;
  return null;
};

/**
 * Real-console style panel.
 * - Console: filter chips, log rows with expandable objects, and an inline prompt
 *   at the end of the log list (Enter runs, Shift+Enter adds a line, history, autocomplete).
 * - Elements: DOM tree with a Styles / Computed inspector (see ElementsPanel).
 */
export default function ConsolePanel({ visible, iframeRef, logs, setLogs }) {
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const [mode, setMode] = useState('console');
  const [refreshTick, setRefreshTick] = useState(0);
  const [filter, setFilter] = useState('all');
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const historyRef = useRef([]);
  const historyIndexRef = useRef(0);
  const completeIdRef = useRef(0);
  const completeTimerRef = useRef(null);
  const lastKeyRef = useRef('');

  // Touch devices get history buttons and a 16px prompt (avoids the iOS focus zoom)
  const isTouch = useMemo(
    () => (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) || false,
    []
  );

  // Number of errors / warnings, shown on the filter chips
  const counts = useMemo(() => {
    const result = { error: 0, warn: 0 };
    logs.forEach((log) => {
      if (log.level === 'error') result.error += 1;
      if (log.level === 'warn') result.warn += 1;
    });
    return result;
  }, [logs]);

  // Apply the filter and merge consecutive identical messages into one row with a counter
  const rows = useMemo(() => {
    const out = [];

    logs.forEach((log) => {
      const isUserRow = log.level === 'input' || log.level === 'result';
      if (!isUserRow && filter !== 'all' && categoryOf(log.level) !== filter) return;

      const prev = out[out.length - 1];
      if (
        prev &&
        !isUserRow &&
        !log.value &&
        !prev.value &&
        prev.level === log.level &&
        prev.message === log.message
      ) {
        prev.count += 1;
        return;
      }

      out.push({ ...log, count: 1 });
    });

    return out;
  }, [logs, filter]);

  // Keep the list scrolled to the newest row / the prompt
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows.length, logs.length, visible, mode, input]);

  // On desktop, start typing right away when the console opens
  useEffect(() => {
    if (visible && mode === 'console' && !isTouch) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [visible, mode, isTouch]);

  // Receive autocomplete answers from the iframe
  useEffect(() => {
    const handleMessage = (event) => {
      if (
        !iframeRef.current ||
        event.source !== iframeRef.current.contentWindow ||
        event.data?.type !== 'DEVTOOLS_COMPLETE_RESULT' ||
        event.data.id !== completeIdRef.current
      ) {
        return;
      }
      setSuggestions(event.data.items || []);
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(completeTimerRef.current);
    };
  }, [iframeRef]);

  /* ---------- Autocomplete ---------- */
  // Looks at the text before the caret and asks the iframe for matching property names
  const requestSuggestions = (value, caret) => {
    clearTimeout(completeTimerRef.current);

    const before = value.slice(0, caret);
    const match = before.match(/((?:[A-Za-z_$][\w$]*\.)*)([A-Za-z_$][\w$]*)?$/);
    const path = match && match[1] ? match[1].slice(0, -1) : '';
    const prefix = match && match[2] ? match[2] : '';

    if (!path && !prefix) {
      setSuggestions([]);
      return;
    }

    completeTimerRef.current = setTimeout(() => {
      const target = iframeRef.current?.contentWindow;
      if (!target) return;
      completeIdRef.current += 1;
      target.postMessage(
        { type: 'DEVTOOLS_COMPLETE', id: completeIdRef.current, path, prefix },
        '*'
      );
    }, 120);
  };

  // Replaces the word before the caret with the chosen suggestion
  const applySuggestion = (name) => {
    const el = inputRef.current;
    const caret = el ? el.selectionStart : input.length;
    const before = input.slice(0, caret);
    const after = input.slice(caret);
    const match = before.match(/([A-Za-z_$][\w$]*)?$/);
    const prefixLength = match && match[1] ? match[1].length : 0;
    const head = before.slice(0, before.length - prefixLength) + name;

    setInput(head + after);
    setSuggestions([]);

    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(head.length, head.length);
    });
  };

  /* ---------- Execute ---------- */
  const run = (raw) => {
    const code = raw.trim();
    setInput('');
    setSuggestions([]);
    if (!code) return;

    historyRef.current.push(code);
    historyIndexRef.current = historyRef.current.length;

    // clear / clear() / console.clear() are handled right here, no round trip needed
    if (CLEAR_COMMAND.test(code)) {
      setLogs([]);
      return;
    }

    // Echo the typed command
    setLogs((prev) => [...prev.slice(-499), makeLog('input', code)]);

    const target = iframeRef.current?.contentWindow;
    if (!target) {
      setLogs((prev) => [...prev, makeLog('error', 'Preview is not ready yet.')]);
      return;
    }

    // The iframe bridge evaluates the code and replies with a DEVTOOLS_LOG message
    target.postMessage({ type: 'DEVTOOLS_EXEC', code }, '*');
  };

  // Moves through previously executed commands (direction: -1 = older, 1 = newer)
  const browseHistory = (direction) => {
    const history = historyRef.current;
    if (history.length === 0) return;

    const next = Math.min(history.length, Math.max(0, historyIndexRef.current + direction));
    historyIndexRef.current = next;
    setInput(history[next] ?? '');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    lastKeyRef.current = e.key;
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      // Unfinished code (open bracket, block...) gets a new line, like the real console
      if (isIncomplete(input)) return;
      e.preventDefault();
      run(input);
    } else if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault();
      applySuggestion(suggestions[0]);
    } else if (e.key === 'ArrowUp' && !input.includes('\n')) {
      e.preventDefault();
      browseHistory(-1);
    } else if (e.key === 'ArrowDown' && !input.includes('\n')) {
      e.preventDefault();
      browseHistory(1);
    }
  };

  const handleChange = (e) => {
    const value = e.target.value;

    // Some mobile keyboards send no usable keydown for Enter, so catch the line break here
    if (e.nativeEvent.inputType === 'insertLineBreak' && lastKeyRef.current !== 'Enter') {
      const code = value.replace(/\n$/, '');
      if (value.endsWith('\n') && !isIncomplete(code)) {
        run(code);
        return;
      }
    }

    setInput(value);
    requestSuggestions(value, e.target.selectionStart);
  };

  // Tapping the empty space under the logs focuses the prompt
  const focusPrompt = () => {
    if (window.getSelection && String(window.getSelection())) return;
    inputRef.current?.focus();
  };

  const isConsole = mode === 'console';

  return (
    <div
      className={`h-full w-full flex-col bg-[#1e1e1e] font-mono text-xs text-[#d4d4d4] ${visible ? 'flex' : 'hidden'
        }`}
    >
      {/* TOP BAR: mode switch, filter chips, actions */}
      <div className="flex flex-shrink-0 items-center gap-1.5 border-b border-[#333333] bg-[#252526] px-2 py-1.5">
        <div className="flex flex-shrink-0 items-center rounded-md border border-[#3c3c3c] bg-[#1e1e1e] p-0.5">
          {['console', 'elements'].map((id) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`rounded px-2.5 py-1 text-[11px] font-semibold capitalize ${mode === id ? 'bg-[#5ab0ff] text-slate-950' : 'text-[#bbbbbb]'
                }`}
            >
              {id}
            </button>
          ))}
        </div>

        {isConsole ? (
          <div className="flex flex-1 items-center gap-1.5 overflow-x-auto scrollbar-none">
            {FILTERS.map(({ id, label }) => {
              const count = counts[id] || 0;
              return (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`flex flex-shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${filter === id
                      ? 'border-[#5ab0ff] bg-[#5ab0ff]/20 text-[#9cd0ff]'
                      : 'border-[#3c3c3c] bg-[#2d2d2d] text-[#bbbbbb]'
                    }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={id === 'error' ? 'text-[#ff8080]' : 'text-[#f4bd00]'}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {isConsole && isTouch && (
          <>
            <button
              onMouseDown={keepFocus}
              onClick={() => browseHistory(-1)}
              title="Previous command"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-[#333333] text-[#cccccc] active:bg-[#444444]"
            >
              <IconChevronDown className="h-4 w-4 rotate-180" />
            </button>
            <button
              onMouseDown={keepFocus}
              onClick={() => browseHistory(1)}
              title="Next command"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-[#333333] text-[#cccccc] active:bg-[#444444]"
            >
              <IconChevronDown className="h-4 w-4" />
            </button>
          </>
        )}

        {isConsole ? (
          <button
            onClick={() => setLogs([])}
            title="Clear console"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-[#333333] text-[#cccccc] active:bg-[#444444]"
          >
            <IconClear className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => setRefreshTick((t) => t + 1)}
            title="Refresh elements"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-[#333333] text-base text-[#cccccc] active:bg-[#444444]"
          >
            {'\u21BB'}
          </button>
        )}
      </div>

      {/* CONSOLE (stays mounted so input, history and filters are kept) */}
      <div className={`min-h-0 flex-1 flex-col ${isConsole ? 'flex' : 'hidden'}`}>
        {/* LOG LIST + inline prompt */}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex min-h-full flex-col">
            {rows.map((row) => (
              <div
                key={row.id}
                className={`flex items-start gap-1.5 border-b px-2 py-1 leading-relaxed ${ROW_STYLES[row.level] || ROW_STYLES.default
                  }`}
              >
                <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                  <Gutter level={row.level} />
                </span>

                {row.count > 1 && (
                  <span className="mt-0.5 flex-shrink-0 rounded-full bg-[#3c3c3c] px-1.5 text-[10px] leading-4 text-[#cccccc]">
                    {row.count}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  {row.value ? (
                    <ConsoleValue node={row.value} />
                  ) : (
                    <pre className="whitespace-pre-wrap break-all font-mono text-xs">{row.message}</pre>
                  )}
                </div>
              </div>
            ))}

            {/* PROMPT (last line of the console, like Chrome DevTools) */}
            <div className="flex items-start gap-1.5 px-2 py-1">
              <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center pt-0.5 font-bold text-[#5ab0ff]">
                {'>'}
              </span>
              <textarea
                ref={inputRef}
                value={input}
                rows={Math.min(8, Math.max(1, input.split('\n').length))}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Type JavaScript..."
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="go"
                style={{ fontSize: isTouch ? 16 : 12, lineHeight: isTouch ? '22px' : '19.5px' }}
                className="block min-w-0 flex-1 resize-none bg-transparent p-0 font-mono text-[#d4d4d4] outline-none placeholder:text-[#555555]"
              />
            </div>

            <div className="min-h-[24px] flex-1" onClick={focusPrompt} />
          </div>
        </div>

        {/* AUTOCOMPLETE SUGGESTIONS (only visible while there are matches) */}
        {suggestions.length > 0 && (
          <div className="flex flex-shrink-0 items-center gap-1.5 overflow-x-auto scrollbar-none border-t border-[#333333] bg-[#252526] px-2 py-1.5">
            {suggestions.map((name) => (
              <button
                key={name}
                onMouseDown={keepFocus}
                onClick={() => applySuggestion(name)}
                className="flex-shrink-0 rounded bg-[#333333] px-2 py-1 text-[12px] text-[#9cdcfe] active:bg-[#444444]"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ELEMENTS INSPECTOR */}
      <ElementsPanel
        active={visible && mode === 'elements'}
        iframeRef={iframeRef}
        refreshTick={refreshTick}
      />
    </div>
  );
}