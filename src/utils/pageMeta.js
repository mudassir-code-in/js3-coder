// Reads the <title> and favicon from the compiled preview HTML.
// DOMParser does not execute scripts, so it is safe to run on user code.

const DEFAULT_TITLE = 'Untitled';

// Removes a leading "./" or "/" so paths can be compared
const normalizePath = (p = '') => p.replace(/^\.?\//, '').replace(/^\//, '');

// Resolves a favicon href into something an <img> can display
const resolveIcon = (href, files) => {
  if (!href) return null;

  // Absolute sources can be used directly
  if (/^(data:|https?:|blob:)/i.test(href)) return href;

  // Relative path: look for a project file that stores a data URL
  const wanted = normalizePath(href);
  const match = (files || []).find((f) => normalizePath(f.path) === wanted);
  if (match && typeof match.content === 'string' && match.content.startsWith('data:')) {
    return match.content;
  }

  return null;
};

export function getPageMeta(html, files) {
  try {
    const doc = new DOMParser().parseFromString(html || '', 'text/html');
    const title = (doc.title || '').trim() || DEFAULT_TITLE;
    const iconEl = doc.querySelector('link[rel~="icon"], link[rel="shortcut icon"]');
    const favicon = resolveIcon(iconEl?.getAttribute('href'), files);
    return { title, favicon };
  } catch {
    return { title: DEFAULT_TITLE, favicon: null };
  }
}