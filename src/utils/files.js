export const MAX_FILE_BYTES = 150 * 1024 * 1024; // 150 MB

export const readAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const readAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

// data URL -> bytes
export const dataURLToBytes = (dataUrl) => {
  const body = (dataUrl || '').split(',')[1] || '';
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

// data URL -> Blob 
export const dataURLToBlob = (dataUrl) => {
  const head = (dataUrl || '').split(',')[0] || '';
  const mime = head.match(/:(.*?)[;,]/)?.[1] || 'application/octet-stream';
  return new Blob([dataURLToBytes(dataUrl)], { type: mime });
};

export const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

// "My Photo (1).PNG" -> "my-photo-1.png"
export const sanitizeName = (name) => {
  const clean = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '');

 
  return clean.startsWith('.') ? `file${clean}` : clean;
};


export const uniqueName = (name, existing) => {
  if (!existing.includes(name)) return name;

  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';

  let i = 1;
  while (existing.includes(`${base}-${i}${ext}`)) i++;
  return `${base}-${i}${ext}`;
};