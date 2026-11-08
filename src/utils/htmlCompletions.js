let registered = false;

const VOID = ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];

const TAGS = [
  'div', 'span', 'p', 'a', 'img', 'button', 'input', 'form', 'label', 'select', 'option', 'textarea',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'header', 'footer', 'nav', 'main', 'section', 'article', 'aside', 'figure', 'figcaption',
  'strong', 'em', 'b', 'i', 'u', 'small', 'br', 'hr', 'canvas', 'video', 'audio', 'source', 'iframe',
  'script', 'style', 'link', 'meta', 'title', 'head', 'body', 'html', 'pre', 'code', 'svg', 'details', 'summary'
];

const SPECIAL = {
  a: '<a href="$1">$0</a>',
  img: '<img src="$1" alt="$2" />',
  input: '<input type="$1" placeholder="$2" />',
  link: '<link rel="stylesheet" href="$1" />',
  meta: '<meta name="$1" content="$2" />',
  script: '<script>\n\t$0\n</script>',
  style: '<style>\n\t$0\n</style>',
  button: '<button>$0</button>',
  br: '<br />',
  hr: '<hr />',
  video: '<video src="$1" controls>$0</video>',
  audio: '<audio src="$1" controls>$0</audio>',
  iframe: '<iframe src="$1">$0</iframe>',
  source: '<source src="$1" type="$2" />'
};

const ATTRS = [
  ['class', 'class="$1"'], ['id', 'id="$1"'], ['style', 'style="$1"'], ['href', 'href="$1"'],
  ['src', 'src="$1"'], ['alt', 'alt="$1"'], ['type', 'type="$1"'], ['name', 'name="$1"'],
  ['value', 'value="$1"'], ['placeholder', 'placeholder="$1"'], ['title', 'title="$1"'],
  ['target', 'target="_blank"'], ['rel', 'rel="$1"'], ['width', 'width="$1"'], ['height', 'height="$1"'],
  ['onclick', 'onclick="$1"'], ['data-', 'data-$1="$2"'], ['for', 'for="$1"'], ['lang', 'lang="$1"'],
  ['charset', 'charset="UTF-8"'], ['content', 'content="$1"'], ['disabled', 'disabled'],
  ['checked', 'checked'], ['required', 'required'], ['autoplay', 'autoplay'], ['controls', 'controls'],
  ['loop', 'loop'], ['muted', 'muted'], ['hidden', 'hidden'], ['viewBox', 'viewBox="$1"']
];

const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length));

const insideRaw = (text) => {
  const t = text.toLowerCase();
  const s = t.lastIndexOf('<script');
  const sc = t.lastIndexOf('</script');
  const st = t.lastIndexOf('<style');
  const stc = t.lastIndexOf('</style');
  return (s > sc && t.indexOf('>', s) !== -1) || (st > stc && t.indexOf('>', st) !== -1);
};

const getOpenTags = (text) => {
  const stack = [];
  const clean = stripComments(text);
  const re = /<(\/?)([a-zA-Z][\w-]*)([^<>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(clean))) {
    const closing = m[1];
    const n = m[2].toLowerCase();
    const selfClose = m[4];
    if (selfClose || VOID.includes(n)) continue;
    if (closing) {
      const idx = stack.lastIndexOf(n);
      if (idx !== -1) stack.length = idx;
    } else {
      stack.push(n);
    }
  }
  return stack;
};

const tagSnippet = (tag) => {
  if (SPECIAL[tag]) return SPECIAL[tag];
  if (VOID.includes(tag)) return `<${tag} />`;
  return `<${tag}>$0</${tag}>`;
};

export function setupHtmlCompletions(monaco) {
  if (registered) return;
  registered = true;

  
  try {
    monaco.languages.html.htmlDefaults.setModeConfiguration({
      completionItems: false,
      hovers: true,
      documentSymbols: true,
      links: true,
      documentHighlights: true,
      rename: true,
      colors: true,
      foldingRanges: true,
      selectionRanges: true,
      diagnostics: false,
      documentFormattingEdits: true,
      documentRangeFormattingEdits: true
    });
  } catch (e) {
    console.warn('html mode config failed', e);
  }

  monaco.languages.registerCompletionItemProvider('html', {
    triggerCharacters: ['<', '/', ' ', '-', '"', "'", '='],

    provideCompletionItems(model, position) {
      const textBefore = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      });

      if (insideRaw(textBefore)) return { suggestions: [] };

      const K = monaco.languages.CompletionItemKind;
      const R = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
      const lineBefore = model.getLineContent(position.lineNumber).slice(0, position.column - 1);

      // 1) Closing tag: </
      const closeM = /<\/([\w-]*)$/.exec(lineBefore);
      if (closeM) {
        const open = getOpenTags(textBefore.slice(0, textBefore.length - closeM[0].length));
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - closeM[0].length,
          endColumn: position.column
        };
        const suggestions = [...open].reverse().map((t, i) => ({
          label: `/${t}`,
          kind: K.Property,
          insertText: `</${t}>`,
          filterText: `</${t}`,
          sortText: String(i).padStart(3, '0'),
          range
        }));
       
        return { suggestions, incomplete: true };
      }

     
      const lastLt = textBefore.lastIndexOf('<');
      const lastGt = textBefore.lastIndexOf('>');
      if (lastLt > lastGt) {
        const attrM = /\s([\w:-]*)$/.exec(lineBefore);
        if (attrM) {
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - attrM[1].length,
            endColumn: position.column
          };
          return {
            suggestions: ATTRS.map(([label, snip]) => ({
              label,
              kind: K.Property,
              insertText: snip,
              insertTextRules: R,
              sortText: '0' + label,
              range
            })),
            incomplete: true
          };
        }
        return { suggestions: [] };
      }

    
      const tagM =
        /<([a-zA-Z][\w-]*)?$/.exec(lineBefore) ||
        /(?:^|[\s>])([a-zA-Z][\w-]*)$/.exec(lineBefore);
      if (!tagM) return { suggestions: [] };

      const hasLt = tagM[0].startsWith('<');
      const typed = tagM[1] || '';
      const len = hasLt ? tagM[0].length : typed.length;
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column - len,
        endColumn: position.column
      };

      return {
        suggestions: TAGS.map((tag) => ({
          label: tag,
          kind: K.Snippet,
          detail: `<${tag}>`,
          insertText: tagSnippet(tag),
          insertTextRules: R,
          filterText: hasLt ? `<${tag}` : tag,
          sortText: '0' + tag,
          range
        })),
        incomplete: true
      };
    }
  });
}