import { getKind } from './templates';
import { parentOf, baseName, joinPath, resolveRef } from './paths';

const consoleScript = `
<script>
(function() {
  function formatArg(arg) {
    if (typeof arg === 'object') {
      try { return JSON.stringify(arg, null, 2); } catch (e) { return String(arg); }
    }
    return String(arg);
  }

  function sendLog(level, args) {
    window.parent.postMessage({
      type: 'DEVTOOLS_LOG',
      level: level,
      message: args.map(formatArg).join(' ')
    }, '*');
  }

  ['log', 'warn', 'error', 'info'].forEach(function(level) {
    var original = console[level];
    console[level] = function() {
      var args = Array.prototype.slice.call(arguments);
      original.apply(console, args);
      sendLog(level, args);
    };
  });

  window.onerror = function(msg, source, lineno, colno) {
    sendLog('error', ['Uncaught ' + msg + ' at ' + lineno + ':' + colno]);
  };
})();
</script>`;

const lower = (s) => s.toLowerCase();
const safeStyle = (code) => code.replace(/<\/style/gi, '<\\/style');
const safeScript = (code) => code.replace(/<\/script/gi, '<\\/script');

const isText = (f) => getKind(f) === 'text';
const isHtml = (f) => isText(f) && /\.html?$/i.test(f.name);
const isCss = (f) => isText(f) && /\.css$/i.test(f.name);
const isJs = (f) => isText(f) && /\.js$/i.test(f.name);
const isAsset = (f) => !isText(f);

const URL_RE = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi;
const STR_RE = /(["'])((?:\.{1,2}\/|\/)?[^"'\s<>()]+\.[a-z0-9]{1,8}(?:[?#][^"'\s]*)?)\1/gi;

export const compilePreview = (activeFile, files) => {
  if (!activeFile) return '';

  const byPath = new Map(files.map((f) => [lower(f.path), f]));

  // basename => file 
  const byBase = new Map();
  files.forEach((f) => {
    const k = lower(f.name);
    byBase.set(k, byBase.has(k) ? null : f);
  });

  
  const lookup = (fromDir, ref, accept) => {
    const p = resolveRef(fromDir, ref);
    if (!p) return null;

    const hit = byPath.get(lower(p));
    if (hit && accept(hit)) return hit;

    const base = byBase.get(lower(baseName(p)));
    return base && accept(base) ? base : null;
  };

  const inlineAssets = (code, fromDir) => {
    const swap = (ref) => {
      const hit = lookup(fromDir, ref, isAsset);
      return hit ? hit.content : null;
    };

    let out = code.replace(URL_RE, (m, q, ref) => {
      const d = swap(ref.trim());
      return d ? `url(${q}${d}${q})` : m;
    });

    out = out.replace(STR_RE, (m, q, ref) => {
      const d = swap(ref);
      return d ? `${q}${d}${q}` : m;
    });

    return out;
  };


  const htmls = files.filter(isHtml);
  let htmlFile = isHtml(activeFile) ? activeFile : null;

  if (!htmlFile) {
    const dir = parentOf(activeFile.path);
    htmlFile =
      htmls.find((f) => lower(f.path) === lower(joinPath(dir, 'index.html'))) ||
      htmls.find((f) => lower(f.path) === 'index.html') ||
      htmls[0];
  }

  if (!htmlFile) {
    return `<body style="font-family:sans-serif;padding:20px">
      <p>No .html file found for preview.</p>
    </body>`;
  }

  const htmlDir = parentOf(htmlFile.path);
  let html = htmlFile.content;

 
  html = inlineAssets(html, htmlDir);


  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/\brel\s*=\s*["']?stylesheet/i.test(tag)) return tag;

    const m = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!m) return tag;

    const css = lookup(htmlDir, m[1], isCss);
    if (!css) return tag;

    return `<style>\n/* ${css.path} */\n${safeStyle(
      inlineAssets(css.content, parentOf(css.path))
    )}\n</style>`;
  });

  
  html = html.replace(
    /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script>/gi,
    (tag, src) => {
      const js = lookup(htmlDir, src, isJs);
      if (!js) return tag;

      return `<script>\n// ${js.path}\n${safeScript(
        inlineAssets(js.content, htmlDir)
      )}\n</script>`;
    }
  );

 
  if (/<head\b[^>]*>/i.test(html)) {
    html = html.replace(/<head\b[^>]*>/i, (m) => `${m}${consoleScript}`);
  } else if (/<html\b[^>]*>/i.test(html)) {
    html = html.replace(/<html\b[^>]*>/i, (m) => `${m}<head>${consoleScript}</head>`);
  } else {
    html = `<head>${consoleScript}</head>${html}`;
  }

  return html;
};