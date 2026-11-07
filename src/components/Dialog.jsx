import React, { useState, useEffect, useRef } from 'react';

export default function Dialog({
  title,
  message,
  input = false,
  defaultValue = '',
  placeholder = '',
  selectBase = false,
  options = null, // [{ value, label, depth, disabled }]
  confirmLabel = 'OK',
  danger = false,
  onConfirm, // return null or string error
  onClose
}) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!input || !inputRef.current) return;

    const el = inputRef.current;
    el.focus();

    if (selectBase) {
      const dot = defaultValue.lastIndexOf('.');
      el.setSelectionRange(0, dot > 0 ? dot : defaultValue.length);
    } else {
      el.select();
    }
    // eslint-disable-next-line
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError('');

    let err = null;
    try {
      err = await onConfirm(value);
    } catch (ex) {
      err = ex?.message || 'Something went wrong.';
    }

    if (err) {
      setError(err);
      setBusy(false);
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl"
      >
        <h3 className="mb-1 text-sm font-mono font-bold text-slate-100">{title}</h3>

        {message && (
          <p className="mb-3 whitespace-pre-line break-words text-xs leading-relaxed text-slate-400">
            {message}
          </p>
        )}

        {input && (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError('');
            }}
            placeholder={placeholder}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="mb-2 h-10 w-full rounded border border-slate-700 bg-slate-800 px-3 text-sm font-mono text-slate-100 outline-none focus:border-cyan-500"
          />
        )}

        {options && (
          <div className="mb-2 max-h-56 overflow-y-auto rounded border border-slate-700 bg-slate-950">
            {options.map((opt) => (
              <button
                key={opt.value || '__root__'}
                type="button"
                disabled={opt.disabled}
                onClick={() => setValue(opt.value)}
                style={{ paddingLeft: 12 + (opt.depth || 0) * 14 }}
                className={`flex h-10 w-full items-center gap-2 pr-3 text-left text-sm font-mono ${
                  opt.disabled
                    ? 'text-slate-600'
                    : value === opt.value
                    ? 'bg-cyan-500/15 text-cyan-300'
                    : 'text-slate-300 active:bg-slate-800'
                }`}
              >
                <span>📁</span>
                <span className="truncate">{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="mb-2 break-words text-xs font-mono text-rose-400">{error}</p>
        )}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 rounded bg-slate-800 text-sm text-slate-300 active:bg-slate-700"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={busy}
            className={`h-10 flex-1 rounded text-sm font-bold disabled:opacity-60 ${
              danger ? 'bg-rose-600 text-white' : 'bg-cyan-500 text-slate-950'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}