// Syntax highlighting in the site's warm palette (see theme/custom.css and STYLE.md).
//
// Stock Shiki themes are cool-toned, and the warm ones mostly set comments below a readable
// contrast. These two are small on purpose: a handful of roles, each colour checked at 4.5:1 or
// better against the code-block surface it sits on (#fffcf6 light, #2b2e26 dark).

interface Palette {
  fg: string;
  comment: string;
  keyword: string;
  string: string;
  number: string;
  func: string;
  type: string;
  prop: string;
  punct: string;
}

function codeTheme(name: string, type: 'light' | 'dark', bg: string, c: Palette) {
  const role = (scope: string[], foreground: string, fontStyle?: string) => ({
    scope,
    settings: fontStyle === undefined ? { foreground } : { foreground, fontStyle },
  });
  return {
    name,
    type,
    colors: { 'editor.background': bg, 'editor.foreground': c.fg },
    tokenColors: [
      role(['variable', 'variable.other', 'variable.parameter', 'meta.definition.variable'], c.fg),
      role(['comment', 'punctuation.definition.comment', 'string.comment'], c.comment, 'italic'),
      role(
        [
          'keyword',
          'storage',
          'storage.type',
          'storage.modifier',
          'keyword.control',
          'keyword.operator.new',
          'keyword.operator.expression',
          'variable.language',
          'punctuation.definition.template-expression',
          'punctuation.section.embedded',
          'markup.heading',
          'markup.deleted',
        ],
        c.keyword,
      ),
      role(
        [
          'keyword.operator',
          'punctuation',
          'meta.brace',
          'punctuation.separator',
          'punctuation.terminator',
          'punctuation.accessor',
        ],
        c.punct,
      ),
      role(
        [
          'string',
          'string.quoted',
          'string.template',
          'punctuation.definition.string',
          'markup.inline.raw',
          'markup.inserted',
        ],
        c.string,
      ),
      // Shell arguments are "strings" to the grammar; read as plain words they stay calm.
      role(['string.unquoted.argument.shell', 'string.unquoted.shell'], c.fg),
      role(
        [
          'constant.numeric',
          'constant.language',
          'constant.character',
          'constant.other.option',
          'support.constant',
          'variable.other.enummember',
        ],
        c.number,
      ),
      role(
        [
          'entity.name.function',
          'support.function',
          'entity.name.command',
          'support.function.builtin',
          'markup.underline.link',
        ],
        c.func,
      ),
      role(
        [
          'entity.name.type',
          'entity.name.class',
          'entity.name.namespace',
          'entity.other.inherited-class',
          'support.type',
          'support.class',
        ],
        c.type,
      ),
      role(
        [
          'support.type.property-name',
          'meta.object-literal.key',
          'variable.other.property',
          'variable.other.object.property',
          'entity.name.tag',
          'entity.other.attribute-name',
        ],
        c.prop,
      ),
      role(['markup.bold'], c.fg, 'bold'),
      role(['markup.italic'], c.fg, 'italic'),
    ],
  };
}

export const molenLight = codeTheme('molen-paper', 'light', '#fffcf6', {
  fg: '#2a2923',
  comment: '#7a7263',
  keyword: '#9b3d26',
  string: '#4e6b2c',
  number: '#8a5a00',
  func: '#255f73',
  type: '#6d4a8a',
  prop: '#6b4a32',
  punct: '#5f5a4d',
});

export const molenDark = codeTheme('molen-ink', 'dark', '#2b2e26', {
  fg: '#eeeadd',
  comment: '#a39f8e',
  keyword: '#eb9c7f',
  string: '#b9cf92',
  number: '#e6c07b',
  func: '#8ec6d6',
  type: '#c9a9e2',
  prop: '#dcc3a5',
  punct: '#bdb8a8',
});
