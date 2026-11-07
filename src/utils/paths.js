export const newId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const baseName = (path) => path.split('/').pop();

export const parentOf = (path) => {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
};

export const joinPath = (parent, name) => (parent ? `${parent}/${name}` : name);

// "a//b/./c/../d" -> "a/b/d"
export const normalizePath = (p) => {
  const out = [];
  p.split('/').forEach((seg) => {
    if (!seg || seg === '.') return;
    if (seg === '..') out.pop();
    else out.push(seg);
  });
  return out.join('/');
};

// HTML/CSS ke andar likhe ref ko workspace path me badalta hai
export const resolveRef = (fromDir, ref) => {
  const clean = ref.split('#')[0].split('?')[0].trim();
  if (!clean) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.startsWith('//')) return ''; // http:, data:, blob:
  return clean.startsWith('/')
    ? normalizePath(clean)
    : normalizePath(joinPath(fromDir, clean));
};

// path folder ke andar hai (ya wahi folder hai)
export const isInside = (path, folderPath) =>
  path === folderPath || path.startsWith(folderPath + '/');

export const validateName = (name) => {
  if (!name) return 'Name is empty';
  if (name === '.' || name === '..') return 'This name not allowed';
  if (/[\\/:*?"<>|]/.test(name)) return 'Not allowed / \\ : * ? " < > | in the name';
  return '';
};


export const planFolders = (dir, items) => {
  const folders = [];
  if (!dir) return { folders, error: '' };

  let cur = '';
  for (const part of dir.split('/')) {
    cur = joinPath(cur, part);
    const hit = items.find((i) => i.path.toLowerCase() === cur.toLowerCase());

    if (!hit) {
      folders.push({ id: newId(), name: part, path: cur, kind: 'folder' });
    } else if (hit.kind !== 'folder') {
      return { folders: [], error: `"${cur}" It is a file, not a folder.` };
    }
  }

  return { folders, error: '' };
};

// parent path ->  (folders pehle, phir files, A-Z)
export const buildTree = (items) => {
  const byParent = new Map();

  items.forEach((it) => {
    const p = parentOf(it.path);
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(it);
  });

  byParent.forEach((list) =>
    list.sort((a, b) => {
      const fa = a.kind === 'folder';
      const fb = b.kind === 'folder';
      if (fa !== fb) return fa ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    })
  );

  return byParent;
};


export const flattenTree = (byParent, expanded) => {
  const rows = [];

  const walk = (parent, depth) => {
    (byParent.get(parent) || []).forEach((item) => {
      rows.push({ item, depth });
      if (item.kind === 'folder' && expanded.has(item.path)) {
        walk(item.path, depth + 1);
      }
    });
  };

  walk('', 0);
  return rows;
};