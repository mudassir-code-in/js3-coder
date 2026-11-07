import { getKind, getMimeType } from './templates';
import { dataURLToBlob, dataURLToBytes } from './files';
import { isInside } from './paths';
import { buildZip } from './zip';

const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

const toBytes = (file) =>
  getKind(file) === 'text'
    ? new TextEncoder().encode(file.content || '')
    : dataURLToBytes(file.content);

export const downloadItem = (item, items) => {
  // FOLDER => ZIP
  if (item.kind === 'folder') {
    const inside = items.filter(
      (i) => i.id !== item.id && isInside(i.path, item.path)
    );

    const entries = [
      { path: item.name, isDir: true, data: null },
      ...inside.map((i) => ({
        path: `${item.name}/${i.path.slice(item.path.length + 1)}`,
        isDir: i.kind === 'folder',
        data: i.kind === 'folder' ? null : toBytes(i)
      }))
    ].sort((a, b) => a.path.localeCompare(b.path));

    saveBlob(buildZip(entries), `${item.name}.zip`);
    return;
  }

  // FILE
  if (getKind(item) === 'text') {
    saveBlob(
      new Blob([item.content || ''], { type: `${getMimeType(item.name)};charset=utf-8` }),
      item.name
    );
  } else {
    saveBlob(dataURLToBlob(item.content), item.name);
  }
};