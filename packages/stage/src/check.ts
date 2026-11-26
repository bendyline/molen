import { registerFiguresSchema } from '@bendyline/molen-figures/schema';
import {
  formatIssues,
  noticeIssues,
  type SceneManifest,
  type ValidationIssue,
  validateByKind,
} from '@bendyline/molen-schema';
import { TICK_RATE } from './common';
import { compileFilm, lintFilm } from './film';
import { compileGame } from './game';

/** The three documents a language model writes for Molen. */
export type DocumentKind = 'film' | 'game' | 'scene';

export const DOCUMENT_FORMATS: Readonly<Record<DocumentKind, string>> = {
  film: 'molen/film@1',
  game: 'molen/game@1',
  scene: 'molen/scene@3',
};

export type CheckDocumentResult =
  | {
      ok: true;
      kind: DocumentKind;
      /** The data-only scene the document plays as (the document itself for a scene). */
      scene: SceneManifest;
      /** What a viewer or a play test would notice; the document is valid either way. */
      notices: ValidationIssue[];
      /** One plain line saying what the document is, e.g. `a film 9.0 s long with 3 in the cast`. */
      summary: string;
    }
  | {
      ok: false;
      /** Null when the document is not one of the three. */
      kind: DocumentKind | null;
      issues: ValidationIssue[];
      formatted: string;
    };

const FORMAT_LIST = Object.values(DOCUMENT_FORMATS)
  .map((f) => `"${f}"`)
  .join(', ');

/** Which of the three documents this is, by its `format` (any version), or null. */
export function documentKind(doc: unknown): DocumentKind | null {
  const format = (doc as { format?: unknown } | null)?.format;
  if (typeof format !== 'string') return null;
  for (const kind of Object.keys(DOCUMENT_FORMATS) as DocumentKind[]) {
    if (format.startsWith(`molen/${kind}@`)) return kind;
  }
  return null;
}

function fail(
  kind: DocumentKind | null,
  label: string,
  issues: ValidationIssue[],
): CheckDocumentResult {
  return { ok: false, kind, issues, formatted: formatIssues(label, issues) };
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Check any document a model wrote — a film, a game, or a data-only scene — the way a host that
 * will play it needs: a film or game must compile, a scene must validate and carry no scripts.
 * Returns the scene it plays as, notices, and a one-line summary; or the issues in Molen's usual
 * format, ready to hand back to the model.
 */
export function checkDocument(doc: unknown): CheckDocumentResult {
  const kind = documentKind(doc);
  const name = (doc as { name?: unknown } | null)?.name;
  const named = typeof name === 'string' ? ` "${name}"` : '';
  if (kind === null) {
    const format = (doc as { format?: unknown } | null)?.format;
    return fail(null, 'document', [
      {
        path: '/format',
        code: 'unknown_format',
        message:
          typeof format === 'string'
            ? `"${format}" is not a document this checker reads`
            : 'a Molen document names its format',
        expected: `one of: ${FORMAT_LIST}`,
        ...(typeof format === 'string' ? { received: JSON.stringify(format) } : {}),
      },
    ]);
  }

  if (kind === 'film') {
    const r = compileFilm(doc);
    if (!r.ok) return { ok: false, kind, issues: r.issues, formatted: r.formatted };
    const seconds = (r.info.lengthTicks / TICK_RATE).toFixed(1);
    return {
      ok: true,
      kind,
      scene: r.scene,
      notices: noticeIssues(lintFilm(doc)),
      summary: `a film${named} ${seconds} s long with ${plural(r.info.cast.length, 'cast member')} and ${plural(r.info.props.length, 'prop')}`,
    };
  }

  if (kind === 'game') {
    const r = compileGame(doc);
    if (!r.ok) return { ok: false, kind, issues: r.issues, formatted: r.formatted };
    const gameKind = (doc as { kind?: unknown }).kind === 'platformer' ? 'platformer' : 'top-down';
    const rows = r.info.map.length;
    const columns = r.info.map[0]?.length ?? 0;
    return {
      ok: true,
      kind,
      scene: r.scene,
      notices: r.warnings,
      summary: `a ${gameKind} game${named} on a level ${columns} cells wide and ${rows} deep`,
    };
  }

  registerFiguresSchema();
  const v = validateByKind('scene', doc);
  if (!v.ok) return { ok: false, kind, issues: v.issues, formatted: v.formatted };
  const scene = v.value as SceneManifest;
  if ((scene.scripts ?? []).length > 0) {
    return fail(kind, `scene "${scene.name}"`, [
      {
        path: '/scripts',
        code: 'scripts_not_allowed',
        message: 'a data-only scene has no scripts',
        received: `${plural(scene.scripts.length, 'script')}`,
        hint: 'describe behavior with the rules, cues, path and mover components instead',
        docsRef: 'guide/play-data.md',
      },
    ]);
  }
  return {
    ok: true,
    kind,
    scene,
    notices: v.notices ?? [],
    summary: `a data-only scene${named} with ${plural(scene.entities.length, 'entity', 'entities')}`,
  };
}
