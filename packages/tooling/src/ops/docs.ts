import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SearchDocsInput {
  query: string;
  k?: number;
  /**
   * Also search the binding design plan in docs/ (which states "no code exists yet"). Off by
   * default — those hits describe intent, not the shipped engine. When on, they are tagged.
   */
  includeDesign?: boolean;
  /** Override the base dir to search from (defaults to the located bundle root). */
  baseDir?: string;
}

export interface DocHit {
  path: string;
  score: number;
  excerpt: string;
  design: boolean;
}

export interface SearchDocsOutput {
  ok: boolean;
  hits: DocHit[];
  root?: string;
  formatted: string;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Locate the docs bundle root by walking up from a start dir until a folder containing
 * docs-src/llms.txt is found. Falls back to the start dir. This makes search_docs work
 * regardless of the cwd the MCP server / CLI was launched from.
 */
export async function locateDocsRoot(start: string = process.cwd()): Promise<string> {
  let dir = resolve(start);
  for (;;) {
    if (await exists(join(dir, 'docs-src', 'llms.txt'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Published builds ship the same guide bundle next to the CLI and ops entry points.
  dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (await exists(join(dir, 'docs-src', 'llms.txt'))) return dir;
    const parent = dirname(dir);
    if (parent === dir)
      throw new Error('Molen documentation bundle is missing; reinstall @bendyline/molen-tooling');
    dir = parent;
  }
}

async function collectMd(dir: string): Promise<string[]> {
  const out: string[] = [];
  try {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...(await collectMd(p)));
      else if (entry.name.endsWith('.md') || entry.name.endsWith('.txt')) out.push(p);
    }
  } catch {
    // directory missing — skip
  }
  return out;
}

/** Lexical doc search (term-frequency ranking) over the shipped bundle. */
export async function searchDocs(input: SearchDocsInput): Promise<SearchDocsOutput> {
  const k = input.k ?? 5;
  const terms = input.query.toLowerCase().split(/\s+/).filter(Boolean);
  const root = input.baseDir ?? (await locateDocsRoot());
  if (!(await exists(join(root, 'docs-src', 'llms.txt')))) {
    return { ok: false, hits: [], root, formatted: `Documentation bundle is missing at ${root}` };
  }
  const roots: { dir: string; design: boolean }[] = [
    { dir: join(root, 'docs-src'), design: false },
  ];
  if (input.includeDesign === true) roots.push({ dir: join(root, 'docs'), design: true });

  const hits: DocHit[] = [];
  for (const { dir, design } of roots) {
    for (const file of await collectMd(dir)) {
      let body: string;
      try {
        body = await readFile(file, 'utf8');
      } catch {
        continue;
      }
      const lower = body.toLowerCase();
      let score = 0;
      for (const t of terms) score += lower.split(t).length - 1;
      // Down-rank design-plan prose so shipped guides win on equal footing.
      if (design) score *= 0.5;
      if (score <= 0) continue;
      const idx = lower.indexOf(terms[0] ?? '');
      const excerpt = body
        .slice(Math.max(0, idx - 60), idx + 160)
        .replace(/\s+/g, ' ')
        .trim();
      hits.push({ path: relative(root, file).split(sep).join('/'), score, excerpt, design });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  const top = hits.slice(0, k);
  const formatted =
    top.length === 0
      ? `No matches for "${input.query}".`
      : top
          .map(
            (h) =>
              `• ${h.path}${h.design ? '  [DESIGN PLAN — not necessarily implemented]' : ''}\n  …${h.excerpt}…`,
          )
          .join('\n');
  return { ok: true, hits: top, root, formatted };
}
