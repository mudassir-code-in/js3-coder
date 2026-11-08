import { useState, useRef, useCallback } from 'react';

export default function useHardwareKeyboard() {
  const [screenKeyboard, setScreenKeyboard] = useState(true);

  const enabledRef = useRef(true);
  const editorRef = useRef(null);

  const getTextarea = () => {
    try {
      return editorRef.current?.getDomNode?.()?.querySelector('textarea') || null;
    } catch {
      return null;
    }
  };

  const applyMode = useCallback((enabled, refocus) => {
    const ta = getTextarea();
    if (!ta) return;

    ta.setAttribute('inputmode', enabled ? 'text' : 'none');

    if (refocus && document.activeElement === ta) {
      ta.blur();
      setTimeout(() => ta.focus({ preventScroll: true }), 60);
    }
  }, []);

  const toggleScreenKeyboard = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setScreenKeyboard(next);
    applyMode(next, true);
  }, [applyMode]);

 const attachEditor = useCallback((editor) => {
  editorRef.current = editor;
  enabledRef.current = true;
  setScreenKeyboard(true);
  applyMode(true, false);

  const ta = editor.getDomNode?.()?.querySelector('textarea');
  if (ta) {
    ta.setAttribute('autocomplete', 'off');
    ta.setAttribute('autocorrect', 'off');
    ta.setAttribute('autocapitalize', 'off');
    ta.setAttribute('spellcheck', 'false');
    ta.setAttribute('data-gramm', 'false');
    ta.setAttribute('enterkeyhint', 'enter');
  }
}, [applyMode]);

  return { screenKeyboard, toggleScreenKeyboard, attachEditor };
}