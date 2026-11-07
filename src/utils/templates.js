export const SUPPORTED_EXT = /\.(html|css|js)$/i;
export const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|ico|bmp|avif)$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv|mkv)$/i;

const TEXT_EXT = new Set([
  'html', 'htm', 'css', 'scss', 'less', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx',
  'json', 'jsonc', 'xml', 'yml', 'yaml', 'toml', 'ini', 'env', 'md', 'markdown',
  'txt', 'log', 'csv', 'tsv', 'py', 'java', 'c', 'h', 'cpp', 'hpp', 'cs', 'go',
  'rs', 'rb', 'php', 'swift', 'kt', 'sh', 'bat', 'sql', 'vue', 'svelte',
  'gitignore', 'conf'
]);

export const getExt = (filename) =>
  (filename || '').split('.').pop().toLowerCase();

// kind: text | image | pdf | audio | video | binary
export const detectKind = (name, mime = '') => {
  const ext = getExt(name);

  if (mime.startsWith('image/') || IMAGE_EXT.test(name)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (TEXT_EXT.has(ext)) return 'text'; 
  if (mime.startsWith('audio/') || AUDIO_EXT.test(name)) return 'audio';
  if (mime.startsWith('video/') || VIDEO_EXT.test(name)) return 'video';
  if (mime.startsWith('text/') || /json|xml|javascript/.test(mime)) return 'text';
  return 'binary';
};


export const getKind = (file) =>
  file?.kind || detectKind(file?.name || '');

export const isEditable = (file) => !!file && getKind(file) === 'text';
export const isImageFile = (file) => !!file && getKind(file) === 'image';
export const isAssetFile = (file) => !!file && getKind(file) !== 'text';

const LANGUAGES = {
  html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript', json: 'json', jsonc: 'json',
  xml: 'xml', yml: 'yaml', yaml: 'yaml', ini: 'ini', toml: 'ini',
  md: 'markdown', markdown: 'markdown', py: 'python', java: 'java',
  c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cs: 'csharp', go: 'go',
  rs: 'rust', rb: 'ruby', php: 'php', swift: 'swift', kt: 'kotlin',
  sh: 'shell', bat: 'bat', sql: 'sql'
};

export const getLanguage = (filename) =>
  LANGUAGES[getExt(filename)] || 'plaintext';

const MIME_TYPES = {
  html: 'text/html', css: 'text/css', js: 'text/javascript',
  json: 'application/json', md: 'text/markdown', xml: 'application/xml',
  csv: 'text/csv'
};

export const getMimeType = (filename) =>
  MIME_TYPES[getExt(filename)] || 'text/plain';

const BADGES = {
  html: ['HTML', 'text-orange-400'],
  htm: ['HTML', 'text-orange-400'],
  css: ['CSS', 'text-cyan-400'],
  js: ['JS', 'text-yellow-400'],
  json: ['JSON', 'text-green-400'],
  md: ['MD', 'text-sky-400'],
  txt: ['TXT', 'text-slate-300'],
  pdf: ['PDF', 'text-red-400'],
  doc: ['DOC', 'text-blue-400'],
  docx: ['DOC', 'text-blue-400'],
  xls: ['XLS', 'text-emerald-400'],
  xlsx: ['XLS', 'text-emerald-400'],
  csv: ['CSV', 'text-emerald-400'],
  ppt: ['PPT', 'text-orange-300'],
  pptx: ['PPT', 'text-orange-300'],
  zip: ['ZIP', 'text-amber-400'],
  rar: ['ZIP', 'text-amber-400'],
  py: ['PY', 'text-blue-300'],
  mp3: ['AUD', 'text-fuchsia-400'],
  wav: ['AUD', 'text-fuchsia-400'],
  mp4: ['VID', 'text-violet-400'],
  webm: ['VID', 'text-violet-400']
};

export const getBadge = (filename) => {
  if (IMAGE_EXT.test(filename)) return { label: 'IMG', color: 'text-pink-400' };

  const ext = getExt(filename);
  const hit = BADGES[ext];
  if (hit) return { label: hit[0], color: hit[1] };

  return { label: ext.slice(0, 4).toUpperCase() || 'FILE', color: 'text-slate-400' };
};

export const getBoilerplate = (filename) => {
  const ext = getExt(filename);

  if (ext === 'css') {
    return `/* ${filename} */

body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #0f172a;
  color: #f8fafc;
  font-family: Arial, sans-serif;
}

h1 {
  color: #22d3ee;
}
`;
  }

  if (ext === 'js') {
    return `// ${filename}

console.log("JS loaded!");
`;
  }

  if (ext === 'html' || ext === 'htm') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>

  <h1>Hello World!</h1>

</body>
</html>`;
  }

  return ''; 
};