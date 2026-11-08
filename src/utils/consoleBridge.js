/* ---------- Console bridge ----------
   The preview iframe is sandboxed (no allow-same-origin), so the parent cannot call
   eval inside it. The function below is stringified and injected into the preview
   HTML. It receives commands via postMessage, runs them in the iframe's global scope
   and replies with structured values so the console can show expandable objects.
   NOTE: it must stay self-contained (no references to variables outside the function). */
function consoleBridge() {
  var MAX_DEPTH = 4;
  var MAX_PROPS = 100;
  var PATH_PATTERN = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

  // Sends a log entry (optionally with a structured value) to the parent editor
  function send(level, message, value) {
    parent.postMessage({ type: 'DEVTOOLS_LOG', level: level, message: message, value: value }, '*');
  }

  // Safe class name of an object
  function className(v) {
    try {
      var c = v.constructor;
      return c && c.name ? c.name : 'Object';
    } catch (e) {
      return 'Object';
    }
  }

  // One-line header of a function, like "f add(a, b)"
  function fnHeader(fn) {
    var src = Function.prototype.toString.call(fn);
    if (/^class\b/.test(src)) return 'class ' + (fn.name || '');
    var m = src.match(/^(?:async\s+)?(?:function\s*\*?\s*[\w$]*\s*)?\(([^)]*)\)/);
    return '\u0192 ' + (fn.name || '') + '(' + (m ? m[1] : '') + ')';
  }

  // Very short preview used inside collapsed objects
  function shortPreview(v) {
    var t = typeof v;
    if (v === null) return 'null';
    if (t === 'undefined') return 'undefined';
    if (t === 'string') return "'" + (v.length > 24 ? v.slice(0, 24) + '\u2026' : v) + "'";
    if (t === 'function') return '\u0192';
    if (t === 'symbol') return String(v);
    if (t === 'object') {
      if (Array.isArray(v)) return 'Array(' + v.length + ')';
      if (v instanceof Element) return '<' + v.tagName.toLowerCase() + '>';
      return '{\u2026}';
    }
    return String(v);
  }

  // Reads a property without letting a throwing getter break the console
  function safeGet(obj, key) {
    try {
      return obj[key];
    } catch (e) {
      return '(unreadable)';
    }
  }

  // Preview text of an array or plain object
  function buildPreview(v, isArr, keys) {
    var parts = [];
    for (var i = 0; i < keys.length && i < 5; i++) {
      var shown = shortPreview(safeGet(v, keys[i]));
      parts.push(isArr ? shown : keys[i] + ': ' + shown);
    }
    var tail = keys.length > 5 ? ', \u2026' : '';
    return (isArr ? '[' : '{') + parts.join(', ') + tail + (isArr ? ']' : '}');
  }

  // Turns any value into a plain, cloneable tree that the parent can render
  function serialize(v, depth, stack) {
    var t = typeof v;
    if (v === null) return { t: 'null' };
    if (t === 'undefined') return { t: 'undefined' };
    if (t === 'string') return { t: 'string', v: v.length > 2000 ? v.slice(0, 2000) + '\u2026' : v };
    if (t === 'number' || t === 'boolean') return { t: 'number', v: String(v) };
    if (t === 'bigint') return { t: 'number', v: String(v) + 'n' };
    if (t === 'symbol') return { t: 'symbol', v: String(v) };
    if (t === 'function') return { t: 'function', v: fnHeader(v) };
    if (v instanceof Error) return { t: 'error', v: String(v.stack || v.name + ': ' + v.message) };
    if (v instanceof Element) {
      var html = v.outerHTML;
      return { t: 'element', v: html.length > 300 ? html.slice(0, 300) + '\u2026' : html };
    }
    if (v instanceof Date || v instanceof RegExp) return { t: 'special', v: String(v) };
    if (typeof Promise !== 'undefined' && v instanceof Promise) return { t: 'special', v: 'Promise {\u2026}' };
    if (stack.indexOf(v) !== -1) return { t: 'circular' };

    stack.push(v);
    var isArr = Array.isArray(v);
    var isMap = typeof Map !== 'undefined' && v instanceof Map;
    var isSet = typeof Set !== 'undefined' && v instanceof Set;
    var node = { t: 'object', prefix: '', preview: '{\u2026}', props: null, more: 0 };

    if (isArr) node.prefix = '(' + v.length + ')';
    else if (isMap) node.prefix = 'Map(' + v.size + ')';
    else if (isSet) node.prefix = 'Set(' + v.size + ')';
    else {
      var cn = className(v);
      node.prefix = cn === 'Object' ? '' : cn;
    }

    var keys = [];
    try {
      keys = Object.keys(v);
    } catch (e) {}
    if (isArr || (!isMap && !isSet)) node.preview = buildPreview(v, isArr, keys);

    if (depth > 0) {
      node.props = [];
      if (isMap) {
        v.forEach(function (val, key) {
          if (node.props.length < MAX_PROPS) {
            node.props.push({ k: shortPreview(key) + ' =>', v: serialize(val, depth - 1, stack) });
          }
        });
      } else if (isSet) {
        var idx = 0;
        v.forEach(function (val) {
          if (idx < MAX_PROPS) node.props.push({ k: String(idx), v: serialize(val, depth - 1, stack) });
          idx++;
        });
      } else {
        for (var i = 0; i < keys.length && i < MAX_PROPS; i++) {
          node.props.push({ k: keys[i], v: serialize(safeGet(v, keys[i]), depth - 1, stack) });
        }
        if (keys.length > MAX_PROPS) node.more = keys.length - MAX_PROPS;
      }
    }

    stack.pop();
    return node;
  }

  // Runs the typed code in the global scope
  function runCode(code) {
    // Top-level let/const (column 0) become var so they stay available in later commands
    code = code.replace(/^(let|const)\s+/gm, 'var ');

    // Top-level await support
    if (/\bawait\b/.test(code)) {
      var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      var fn;
      try {
        fn = new AsyncFunction('return (' + code + '\n);');
      } catch (e) {
        fn = new AsyncFunction(code);
      }
      return fn();
    }

    // Object literals like {a: 1} are treated as values, not blocks
    if (/^\s*\{[\s\S]*\}\s*;?\s*$/.test(code)) {
      try {
        return (0, eval)('(' + code.replace(/;\s*$/, '') + ')');
      } catch (e) {}
    }

    // Indirect eval runs in the global scope, so var/function declarations persist
    return (0, eval)(code);
  }

  function reportResult(result) {
    window.$_ = result;
    send('result', '', serialize(result, MAX_DEPTH, []));
  }

  function reportError(err, prefix) {
    var text = err && err.name ? err.name + ': ' + err.message : String(err);
    send('error', prefix + text);
  }

  // Property names for autocomplete (own + inherited), filtered by prefix
  function complete(data) {
    var items = [];
    try {
      if (data.path && !PATH_PATTERN.test(data.path)) throw new Error('unsafe path');
      var target = data.path ? (0, eval)(data.path) : window;
      if (target !== null && target !== undefined) {
        var obj = Object(target);
        var seen = {};
        while (obj) {
          Object.getOwnPropertyNames(obj).forEach(function (name) {
            if (!seen[name] && name.indexOf(data.prefix) === 0) {
              seen[name] = true;
              items.push(name);
            }
          });
          obj = Object.getPrototypeOf(obj);
        }
      }
    } catch (e) {}

    items.sort();
    parent.postMessage(
      { type: 'DEVTOOLS_COMPLETE_RESULT', id: data.id, items: items.slice(0, 30) },
      '*'
    );
  }

  // DevTools-style helpers
  window.clear = function () { send('clear', ''); };
  console.clear = function () { send('clear', ''); };
  if (typeof window.$ === 'undefined') {
    window.$ = function (selector) { return document.querySelector(selector); };
  }
  if (typeof window.$$ === 'undefined') {
    window.$$ = function (selector) {
      return Array.prototype.slice.call(document.querySelectorAll(selector));
    };
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data) return;

    if (data.type === 'DEVTOOLS_COMPLETE') {
      complete(data);
      return;
    }

    if (data.type !== 'DEVTOOLS_EXEC') return;

    try {
      var result = runCode(data.code);
      if (result && typeof result.then === 'function') {
        // Promises are awaited, like real devtools
        result.then(reportResult, function (err) { reportError(err, 'Uncaught (in promise) '); });
      } else {
        reportResult(result);
      }
    } catch (err) {
      reportError(err, 'Uncaught ');
    }
  });
}

// Full <script> tag that runs the bridge inside the preview
const BRIDGE_SCRIPT = '<script>(' + consoleBridge.toString() + ')();<' + '/script>';

// Injects the bridge right before the last </body> (or at the end if there is none)
export const injectBridge = (html) => {
  const idx = html.lastIndexOf('</body>');
  if (idx === -1) return html + BRIDGE_SCRIPT;
  return html.slice(0, idx) + BRIDGE_SCRIPT + html.slice(idx);
};

// Matches commands that should simply clear the console: clear(), clear, console.clear()
export const CLEAR_COMMAND = /^(console\.)?clear(\s*\(\s*\))?\s*;?$/;

// Builds a log entry object (value is an optional structured value for object trees)
export const makeLog = (level, message, value) => ({
  id: Date.now() + Math.random(),
  level,
  message,
  value
});