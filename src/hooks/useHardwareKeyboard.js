import { useState, useEffect, useRef, useCallback } from 'react';


const looksPhysical = (e) => {
  if (e.isComposing || e.keyCode === 229 || e.key === 'Unidentified') return false;
  return Boolean(e.code) && e.code !== 'Unidentified';
};

export default function useHardwareKeyboard() {
  const [screenKeyboard, setScreenKeyboard] = useState(true);
  const [notice, setNotice] = useState('');

  const enabledRef = useRef(true);
  const editorRef = useRef(null);
  const streakRef = useRef(0);

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
      ta.blur(); // opend keyboard closed
      setTimeout(() => ta.focus({ preventScroll: true }), 60);
    }
  }, []);

  const setMode = useCallback((enabled) => {
    enabledRef.current = enabled;
    setScreenKeyboard(enabled);
    applyMode(enabled, true);
  }, [applyMode]);

  const toggleScreenKeyboard = useCallback(() => {
    setNotice('');
    setMode(!enabledRef.current);
  }, [setMode]);

  // Monaco mount 
  const attachEditor = useCallback((editor) => {
    editorRef.current = editor;
    applyMode(enabledRef.current, false);
  }, [applyMode]);

  // Physical keyboard detect 
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!enabledRef.current) return;

      if (looksPhysical(e)) {
        streakRef.current += 1;

        
        if (streakRef.current >= 3) {
          streakRef.current = 0;
          setMode(false);
          setNotice('Physical keyboard detected; on-screen keyboard hidden.');
        }
      } else {
        streakRef.current = 0;
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [setMode]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  return { screenKeyboard, toggleScreenKeyboard, attachEditor, notice, dismissNotice: () => setNotice('') };
}