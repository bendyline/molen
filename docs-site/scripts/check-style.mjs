// Check every molen.dev page against the mechanical rules in docs-site/STYLE.md.
//
// The theme owns how a page looks; these rules keep the markdown from fighting it and keep every
// page shaped the same way: one title, a lede, headings that nest, code that names its language,
// commands a reader who installed from npm can run, callouts in the one syntax that survives
// outside the site. Judgement calls (voice, what goes in a lede) stay in STYLE.md.
//
// Guide and schema pages are checked in `docs-src/`, their source, so a problem names the line
// to edit; every other page is checked as generated, and names the script that writes it. Run
// after `generate-all.mjs` (which calls this): `node scripts/check-style.mjs`.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { repoRoot, siteDir } from './packages.mjs';

/** Where a generated page is written from, for the problem message. */
const WRITERS = [
  ['api/', 'scripts/generate-api.mjs (TSDoc from the built .d.mts)'],
  ['samples/', 'scripts/generate-samples.mjs'],
  ['reference/', 'scripts/generate-cli.mjs'],
];

/** `::: kind` containers VitePress renders. Only generated site pages may use them. */
const CONTAINERS = new Set(['tip', 'info', 'warning', 'danger', 'details']);
const ALERTS = new Set(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']);

/** Commands only a clone of the engine repository can run. */
const CLONE_ONLY = /(?:^|[\s`(])pnpm\s+[\w-]|node\s+(?:\S*\/)?(?:packages|examples)\/\S+/;
const CLONE_CONTEXT = /engine repository/i;

function markdownFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return markdownFiles(path);
      return name.endsWith('.md') ? [path] : [];
    });
}

/** Every page of the site, paired with the file a fix belongs in. */
export function sitePages() {
  const fromDocsSrc = ['guide', 'schemas'].flatMap((section) =>
    markdownFiles(join(repoRoot, 'docs-src', section)).map((file) => ({
      file,
      shipsRaw: true,
      generated: false,
    })),
  );
  const generated = WRITERS.flatMap(([prefix, writer]) =>
    markdownFiles(join(siteDir, prefix)).map((file) => ({ file, writer, generated: true })),
  );
  return [{ file: join(siteDir, 'index.md'), generated: false }, ...fromDocsSrc, ...generated];
}

/** Split off YAML frontmatter; `offset` is the number of lines it took. */
function frontmatter(lines) {
  if (lines[0] !== '---') return { data: '', offset: 0 };
  const end = lines.indexOf('---', 1);
  return end === -1
    ? { data: '', offset: 0 }
    : { data: lines.slice(1, end).join('\n'), offset: end + 1 };
}

/** Text with backtick code spans removed, for checks that must ignore code. */
const withoutCode = (line) => line.replace(/`+[^`]*`+/g, '');

/**
 * Problems in one page. `text` is its markdown; `page.shipsRaw` marks docs-src pages, whose
 * markdown is also read as plain text (npm tarball, llms.txt), so only portable syntax is allowed.
 */
export function checkPage(page, text) {
  const lines = text.split('\n');
  const { data, offset } = frontmatter(lines);
  const home = /^layout:\s*home\b/m.test(data);
  const problems = [];
  const report = (index, message) => problems.push({ line: index + 1, message });

  if (page.generated && !home && !/^title:/m.test(data)) {
    report(0, 'no `title` in the frontmatter');
  }

  let fence = null; // { marker, start, context }
  let paragraph = []; // the prose block being read, for "engine repository" context
  let lastParagraph = '';
  let h1 = 0;
  let headings = 0;
  let level = 0;
  let expectLede = false;

  for (let i = offset; i < lines.length; i++) {
    const line = lines[i];
    const open = line.match(/^\s*(`{3,}|~{3,})\s*([^\s{`]*)/);

    if (fence !== null) {
      const close = line.match(/^\s*(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === fence.marker[0] && close[1].length >= fence.marker.length) {
        const body = lines.slice(fence.start + 1, i).join('\n');
        if (CLONE_ONLY.test(body) && !CLONE_CONTEXT.test(`${fence.context}\n${body}`)) {
          report(
            fence.start,
            'code block runs a clone-only command (pnpm, node packages/…); write what an npm user ' +
              'runs (`npx molen …`, `npm …`), or say "in the engine repository" where it starts',
          );
        }
        fence = null;
      }
      continue;
    }

    if (open) {
      if (expectLede) report(i, 'the title must be followed by a lede paragraph, not code');
      expectLede = false;
      if (open[2] === '') {
        report(i, 'code block names no language; use `sh`, `ts`, `json`, … or `text` for output');
      }
      fence = { marker: open[1], start: i, context: paragraph.join(' ') || lastParagraph };
      continue;
    }

    if (line.trim() === '') {
      if (paragraph.length > 0) lastParagraph = paragraph.join(' ');
      paragraph = [];
      continue;
    }
    paragraph.push(line);

    const heading = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      const depth = heading[1].length;
      const title = heading[2].replace(/\s*\{#[\w-]+\}$/, '');
      headings++;
      if (depth === 1) {
        h1++;
        if (headings > 1) report(i, 'the page title (`#`) must be the first heading');
        if (h1 > 1) report(i, 'more than one `#` title; a page has exactly one');
        expectLede = true;
      } else {
        if (expectLede) report(i, 'the title must be followed by a lede paragraph, not a heading');
        expectLede = false;
      }
      if (level > 0 && depth > level + 1) {
        report(i, `heading jumps from h${level} to h${depth}; nest one level at a time`);
      }
      level = depth;
      if (/[.:]$/.test(withoutCode(title))) {
        report(i, 'heading ends in punctuation; headings are labels, not sentences');
      }
      paragraph = [];
      lastParagraph = '';
      continue;
    }

    if (expectLede) {
      if (/^(\s*[-*+]\s|\s*\d+\.\s|\||<|:::|>|!\[|\[!\[)/.test(line)) {
        report(
          i,
          'the title must be followed by a lede paragraph (plain prose, one to three sentences)',
        );
      }
      expectLede = false;
    }

    const prose = withoutCode(line);
    if (/<[a-z][\w-]*\s[^>]*\b(?:style|class)=/i.test(prose)) {
      report(i, 'raw HTML with `class`/`style`; the theme owns presentation (see STYLE.md)');
    }

    const container = line.match(/^:::\s*(\w+)?/);
    if (container?.[1]) {
      if (page.shipsRaw) {
        report(
          i,
          `\`::: ${container[1]}\` is site-only syntax; docs-src ships raw, use \`> [!TIP]\``,
        );
      } else if (!CONTAINERS.has(container[1])) {
        report(
          i,
          `unknown callout \`::: ${container[1]}\`; use tip, info, warning, danger or details`,
        );
      }
    }
    const alert = line.match(/^>\s*\[!(\w+)\]/);
    if (alert && !ALERTS.has(alert[1])) {
      report(i, `unknown alert \`[!${alert[1]}]\`; use NOTE, TIP, IMPORTANT, WARNING or CAUTION`);
    }

    const spans = line.match(/`[^`]+`/g) ?? [];
    if (spans.some((span) => CLONE_ONLY.test(span))) {
      // The whole paragraph is the context, so read ahead to its end.
      let end = i;
      while (end + 1 < lines.length && lines[end + 1].trim() !== '') end++;
      const context = [...paragraph, ...lines.slice(i + 1, end + 1)].join(' ');
      if (!CLONE_CONTEXT.test(context)) {
        report(
          i,
          'names a clone-only command (pnpm, node packages/…); write what an npm user runs, or ' +
            'say "in the engine repository" in the same paragraph',
        );
      }
    }
  }

  if (fence !== null) report(fence.start, 'code block is never closed');
  if (home && h1 > 0) report(0, 'the home page draws its own title (MolenHome.vue); drop the `#`');
  if (!home && h1 === 0) report(0, 'no `#` title');
  return problems;
}

/** Check the whole site; returns printable problem lines. */
export function checkStyle() {
  const out = [];
  for (const page of sitePages()) {
    const text = readFileSync(page.file, 'utf8');
    const where = relative(repoRoot, page.file);
    for (const { line, message } of checkPage(page, text)) {
      out.push(`${where}:${line}: ${message}${page.writer ? ` [written by ${page.writer}]` : ''}`);
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = checkStyle();
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) {
    console.error(`\n${problems.length} style problem(s); see docs-site/STYLE.md.`);
    process.exit(1);
  }
  console.log('docs style: every page follows docs-site/STYLE.md');
}
