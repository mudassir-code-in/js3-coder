import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Tags that never have a closing tag
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

// Short label for the selected element, like div#app.card.big
const labelOf = (node) => {
  const idAttr = node.attrs.find((a) => a.k === 'id');
  const classAttr = node.attrs.find((a) => a.k === 'class');
  let label = node.tag;
  if (idAttr && idAttr.v) label += '#' + idAttr.v;
  if (classAttr && classAttr.v.trim()) label += '.' + classAttr.v.trim().split(/\s+/).join('.');
  return label;
};

const Arrow = ({ open }) => (
  <svg
    viewBox="0 0 8 8"
    className={`h-2 w-2 text-[#999] transition-transform ${open ? 'rotate-90' : ''}`}
    aria-hidden="true"
  >
    <path d="M1 0l6 4-6 4z" fill="currentColor" />
  </svg>
);

// Attributes of an element, colored like DevTools
const Attrs = ({ attrs }) => (
  <>
    {attrs.map((a) => (
      <span key={a.k}>
        <span className="text-[#9cdcfe]"> {a.k}</span>
        <span className="text-[#808080]">="</span>
        <span className="text-[#ce9178]">{a.v}</span>
        <span className="text-[#808080]">"</span>
      </span>
    ))}
  </>
);

/* ---------- One editable CSS declaration ("name: value;") ---------- */
function PropRow({ name, value, isNew, version, isTouch, onCommit }) {
  const [n, setN] = useState(name);
  const [v, setV] = useState(value);
  const wrapRef = useRef(null);
  const valueRef = useRef(null);

  // Take fresh values from the page, unless the user is typing in this row right now
  useEffect(() => {
    if (wrapRef.current && wrapRef.current.contains(document.activeElement)) return;
    setN(name);
    setV(value);
  }, [name, value, version]);

  const commit = () => {
    const nn = n.trim();
    const vv = v.trim();

    if (isNew) {
      if (nn && vv) {
        onCommit('', nn, vv);
        setN('');
        setV('');
      }
      return;
    }

    if (nn === name && vv === value) return;
    onCommit(name, nn, vv);
  };

  // Commit only when focus leaves the whole row (not when moving between its two inputs)
  const handleBlur = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    commit();
  };

  const fontSize = isTouch ? 16 : 12;

  return (
    <div ref={wrapRef} onBlur={handleBlur} className="flex items-center gap-1 pl-3">
      <input
        value={n}
        placeholder={isNew ? 'property' : ''}
        onChange={(e) => setN(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            valueRef.current?.focus();
          }
        }}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        style={{ fontSize }}
        className="h-7 w-[42%] min-w-0 bg-transparent font-mono text-[#9cdcfe] outline-none placeholder:text-[#555555] focus:bg-[#2a2d2e]"
      />
      <span className="text-[#808080]">:</span>
      <input
        ref={valueRef}
        value={v}
        placeholder={isNew ? 'value' : ''}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        style={{ fontSize }}
        className="h-7 min-w-0 flex-1 bg-transparent font-mono text-[#ce9178] outline-none placeholder:text-[#555555] focus:bg-[#2a2d2e]"
      />
      <span className="text-[#808080]">;</span>
      {!isNew && (
        <button
          title="Remove"
          onClick={() => onCommit(name, '', '')}
          className="h-6 w-6 flex-shrink-0 text-sm text-[#808080] active:text-[#ff8080]"
        >
          ×
        </button>
      )}
    </div>
  );
}

/* ---------- One selector block: "selector { ...declarations }" ---------- */
function StyleBlock({ selector, scope, source, target, props, version, isTouch, onCommit }) {
  const commit = (oldName, name, value) => onCommit(target, oldName, name, value);

  return (
    <div className="border-b border-[#333333] px-2 py-1.5">
      {scope && <div className="break-all text-[#808080]">{scope}</div>}

      <div className="flex items-baseline justify-between gap-2">
        <span className="break-all text-[#d7ba7d]">
          {selector} {'{'}
        </span>
        {source && <span className="flex-shrink-0 text-[10px] text-[#808080]">{source}</span>}
      </div>

      {props.map((p, i) => (
        <PropRow
          key={i}
          name={p.name}
          value={p.value}
          version={version}
          isTouch={isTouch}
          onCommit={commit}
        />
      ))}
      <PropRow isNew name="" value="" version={version} isTouch={isTouch} onCommit={commit} />

      <div className="text-[#d4d4d4]">{'}'}</div>
    </div>
  );
}

/**
 * Elements inspector: DOM tree on one side, Styles / Computed on the other.
 * Talks to the preview iframe through the bridge in utils/consoleBridge.js.
 */
export default function ElementsPanel({ active, iframeRef, refreshTick }) {
  const [childrenMap, setChildrenMap] = useState({}); // node id -> child descriptions
  const [expanded, setExpanded] = useState({}); // node id -> boolean
  const [selected, setSelected] = useState(null);
  const [styleData, setStyleData] = useState(null);
  const [styleVersion, setStyleVersion] = useState(0);
  const [styleTab, setStyleTab] = useState('styles');
  const [computedFilter, setComputedFilter] = useState('');

  const selectedRef = useRef(null);
  const bodyHuntRef = useRef(null); // id of <html> while we wait to auto-open <body>
  const loadedRef = useRef(false);
  const activeRef = useRef(active);

  const isTouch = useMemo(
    () => (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) || false,
    []
  );

  const post = useCallback(
    (message) => {
      const target = iframeRef.current?.contentWindow;
      if (target) target.postMessage(message, '*');
    },
    [iframeRef]
  );

  const reset = useCallback(() => {
    setChildrenMap({});
    setExpanded({});
    setSelected(null);
    setStyleData(null);
    selectedRef.current = null;
    bodyHuntRef.current = null;
    loadedRef.current = false;
  }, []);

  const loadRoot = useCallback(() => {
    loadedRef.current = true;
    post({ type: 'DEVTOOLS_DOM_CHILDREN', id: -1 });
  }, [post]);

  // Load the tree the first time the tab is opened
  useEffect(() => {
    activeRef.current = active;
    if (active && !loadedRef.current) loadRoot();
  }, [active, loadRoot]);

  // Manual refresh button
  useEffect(() => {
    if (refreshTick === 0) return;
    reset();
    if (activeRef.current) loadRoot();
  }, [refreshTick, reset, loadRoot]);

  // Answers coming from the preview iframe
  useEffect(() => {
    const handleMessage = (event) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const data = event.data;
      if (!data) return;

      // The preview was reloaded, so the old tree is stale
      if (data.type === 'DEVTOOLS_READY') {
        reset();
        if (activeRef.current) loadRoot();
        return;
      }

      if (data.type === 'DEVTOOLS_DOM_CHILDREN_RESULT') {
        setChildrenMap((m) => ({ ...m, [data.id]: data.nodes }));

        if (data.id === -1) {
          // Open <html>, then <body>, so the tree starts in a useful state
          const html = data.nodes[0];
          if (html) {
            setExpanded((e) => ({ ...e, [html.id]: true }));
            bodyHuntRef.current = html.id;
            post({ type: 'DEVTOOLS_DOM_CHILDREN', id: html.id });
          }
        } else if (data.id === bodyHuntRef.current) {
          bodyHuntRef.current = null;
          const body = data.nodes.find((n) => n.tag === 'body');
          if (body) {
            setExpanded((e) => ({ ...e, [body.id]: true }));
            post({ type: 'DEVTOOLS_DOM_CHILDREN', id: body.id });
          }
        }
        return;
      }

      if (data.type === 'DEVTOOLS_STYLE_RESULT' && data.id === selectedRef.current) {
        setStyleData(data);
        setStyleVersion((v) => v + 1);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [iframeRef, post, reset, loadRoot]);

  const toggle = (node) => {
    const open = !expanded[node.id];
    setExpanded((e) => ({ ...e, [node.id]: open }));
    // Always ask again so the children are fresh
    if (open) post({ type: 'DEVTOOLS_DOM_CHILDREN', id: node.id });
  };

  const select = (node) => {
    if (node.type !== 1) return;
    selectedRef.current = node.id;
    setSelected(node);
    setStyleData(null);
    post({ type: 'DEVTOOLS_STYLE_GET', id: node.id });
  };

  const commitStyle = (target, oldName, name, value) => {
    post({
      type: 'DEVTOOLS_STYLE_SET',
      id: selectedRef.current,
      target,
      oldName,
      name,
      value
    });
  };

  /* ---------- DOM tree rows ---------- */
  const rows = [];

  const walk = (nodes, depth) => {
    nodes.forEach((node) => {
      const indent = depth * 12 + 2;

      if (node.type === 3) {
        rows.push(
          <div
            key={node.id}
            style={{ paddingLeft: indent + 20 }}
            className="min-w-max whitespace-nowrap py-1 pr-2 text-[#d4d4d4]"
          >
            {node.text}
          </div>
        );
        return;
      }

      if (node.type === 8) {
        rows.push(
          <div
            key={node.id}
            style={{ paddingLeft: indent + 20 }}
            className="min-w-max whitespace-nowrap py-1 pr-2 text-[#6a9955]"
          >
            {'<!-- ' + node.text + ' -->'}
          </div>
        );
        return;
      }

      const hasKids = node.childCount > 0;
      const open = Boolean(expanded[node.id]) && hasKids;
      const isSelected = selected && selected.id === node.id;
      const isVoid = VOID_TAGS.has(node.tag);

      rows.push(
        <div
          key={node.id}
          onClick={() => select(node)}
          style={{ paddingLeft: indent }}
          className={`flex min-w-max items-start whitespace-nowrap py-1 pr-2 ${isSelected ? 'bg-[#094771]' : 'active:bg-[#2a2d2e]'
            }`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasKids) toggle(node);
            }}
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center"
          >
            {hasKids && <Arrow open={open} />}
          </button>

          <span>
            <span className="text-[#808080]">{'<'}</span>
            <span className="text-[#569cd6]">{node.tag}</span>
            <Attrs attrs={node.attrs} />
            <span className="text-[#808080]">{'>'}</span>
            {!open && hasKids && <span className="text-[#808080]">{'…'}</span>}
            {!open && !isVoid && (
              <span className="text-[#808080]">
                {'</'}
                <span className="text-[#569cd6]">{node.tag}</span>
                {'>'}
              </span>
            )}
          </span>
        </div>
      );

      if (open) {
        walk(childrenMap[node.id] || [], depth + 1);

        if (!isVoid) {
          rows.push(
            <div
              key={node.id + '-close'}
              style={{ paddingLeft: indent + 20 }}
              className="min-w-max whitespace-nowrap py-1 pr-2 text-[#808080]"
            >
              {'</'}
              <span className="text-[#569cd6]">{node.tag}</span>
              {'>'}
            </div>
          );
        }
      }
    });
  };

  const rootNodes = childrenMap[-1];
  if (rootNodes) walk(rootNodes, 0);

  /* ---------- Computed list ---------- */
  const computedRows = useMemo(() => {
    if (!styleData) return [];
    const f = computedFilter.trim().toLowerCase();
    if (!f) return styleData.computed;
    return styleData.computed.filter(
      ([k, val]) => k.includes(f) || String(val).toLowerCase().includes(f)
    );
  }, [styleData, computedFilter]);

  return (
    <div
      className={`min-h-0 flex-1 flex-col font-mono text-xs text-[#d4d4d4] md:flex-row ${active ? 'flex' : 'hidden'
        }`}
    >
      {/* DOM TREE */}
      <div className="min-h-0 min-w-0 flex-1 overflow-auto border-b border-[#333333] md:border-b-0 md:border-r">
        {rootNodes ? (
          rows
        ) : (
          <div className="p-3 italic text-[#666666]">Loading DOM...</div>
        )}
      </div>

      {/* STYLES / COMPUTED */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex flex-shrink-0 items-center gap-1.5 border-b border-[#333333] bg-[#252526] px-2 py-1">
          {['styles', 'computed'].map((id) => (
            <button
              key={id}
              onClick={() => setStyleTab(id)}
              className={`flex-shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${styleTab === id
                  ? 'border-[#5ab0ff] bg-[#5ab0ff]/20 text-[#9cd0ff]'
                  : 'border-[#3c3c3c] bg-[#2d2d2d] text-[#bbbbbb]'
                }`}
            >
              {id}
            </button>
          ))}
          <span className="ml-auto min-w-0 truncate text-[11px] text-[#808080]">
            {selected ? labelOf(selected) : ''}
          </span>
        </div>

        {styleTab === 'computed' && selected && (
          <input
            value={computedFilter}
            onChange={(e) => setComputedFilter(e.target.value)}
            placeholder="Filter"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            style={{ fontSize: isTouch ? 16 : 12 }}
            className="h-8 flex-shrink-0 border-b border-[#333333] bg-[#1e1e1e] px-2 font-mono text-[#d4d4d4] outline-none placeholder:text-[#666666]"
          />
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!selected && (
            <div className="p-3 italic text-[#666666]">Select an element in the tree.</div>
          )}

          {selected && !styleData && <div className="p-3 italic text-[#666666]">Loading...</div>}

          {selected && styleData && styleTab === 'styles' && (
            <>
              <StyleBlock
                selector="element.style"
                target="inline"
                props={styleData.inline}
                version={styleVersion}
                isTouch={isTouch}
                onCommit={commitStyle}
              />
              {styleData.rules.map((rule) => (
                <StyleBlock
                  key={rule.index}
                  selector={rule.selector}
                  scope={rule.scope}
                  source={rule.source}
                  target={rule.index}
                  props={rule.props}
                  version={styleVersion}
                  isTouch={isTouch}
                  onCommit={commitStyle}
                />
              ))}
            </>
          )}

          {selected && styleData && styleTab === 'computed' && (
            <div className="py-1">
              {computedRows.map(([k, val]) => (
                <div key={k} className="flex gap-2 px-2 py-0.5">
                  <span className="w-[45%] flex-shrink-0 break-all text-[#9cdcfe]">{k}</span>
                  <span className="min-w-0 break-all text-[#ce9178]">{val}</span>
                </div>
              ))}
              {computedRows.length === 0 && (
                <div className="p-3 italic text-[#666666]">No match.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}