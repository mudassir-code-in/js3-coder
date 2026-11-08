import React, { useState } from 'react';

// Text colors for primitive values, similar to Chrome DevTools (dark theme)
const VALUE_COLORS = {
  string: 'text-[#f28b54]',
  number: 'text-[#9980ff]',
  symbol: 'text-[#f28b54]',
  null: 'text-[#a0a0a0]',
  undefined: 'text-[#808080]',
  function: 'italic text-[#d4d4d4]',
  element: 'text-[#7cacf8]',
  special: 'text-[#d4d4d4]',
  circular: 'text-[#808080]'
};

// Converts a serialized primitive node into display text
const primitiveText = (node) => {
  switch (node.t) {
    case 'string':
      return JSON.stringify(node.v);
    case 'null':
      return 'null';
    case 'undefined':
      return 'undefined';
    case 'circular':
      return '[Circular]';
    default:
      return node.v;
  }
};

// Small expand/collapse triangle
const Arrow = ({ open, visible }) => (
  <svg
    viewBox="0 0 8 8"
    className={`mt-1 h-2 w-2 flex-shrink-0 text-[#999] transition-transform ${open ? 'rotate-90' : ''} ${visible ? '' : 'opacity-0'
      }`}
    aria-hidden="true"
  >
    <path d="M1 0l6 4-6 4z" fill="currentColor" />
  </svg>
);

// Property name shown before a value ("name: value")
const Label = ({ label }) =>
  label === undefined ? null : (
    <>
      <span className="text-[#c792ea]">{label}</span>
      <span className="text-[#888]">: </span>
    </>
  );

/**
 * Renders a serialized value as an expandable tree, like the real DevTools console.
 * `node` comes from the bridge serializer in utils/consoleBridge.js.
 */
export default function ConsoleValue({ node, label }) {
  const [open, setOpen] = useState(false);

  // Errors are shown as plain red text (message + stack)
  if (node.t === 'error') {
    return (
      <div className="whitespace-pre-wrap text-[#ff8080]">
        <Label label={label} />
        {node.v}
      </div>
    );
  }

  // Primitives, functions, elements...
  if (node.t !== 'object') {
    return (
      <div className="break-all">
        <Label label={label} />
        <span className={VALUE_COLORS[node.t] || ''}>{primitiveText(node)}</span>
      </div>
    );
  }

  // Objects and arrays
  const expandable = Boolean(node.props && node.props.length > 0);

  return (
    <div className="min-w-0">
      <div
        className="flex items-start gap-1"
        onClick={() => expandable && setOpen((o) => !o)}
      >
        <Arrow open={open} visible={expandable} />
        <span className="min-w-0 break-all">
          <Label label={label} />
          {node.prefix && <span className="italic text-[#d4d4d4]">{node.prefix} </span>}
          <span className="text-[#d4d4d4]">{node.preview}</span>
        </span>
      </div>

      {open && expandable && (
        <div className="ml-3 border-l border-[#333333] pl-2">
          {node.props.map((prop, i) => (
            <ConsoleValue key={i} node={prop.v} label={prop.k} />
          ))}
          {node.more > 0 && <div className="text-[#888]">... {node.more} more</div>}
        </div>
      )}
    </div>
  );
}