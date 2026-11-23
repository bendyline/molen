/**
 * The headless figure designer: one look under edit, the steer that orders its options, undo and
 * redo, and change notifications. Framework-free and DOM-free; the React designer and any host
 * UI drive it. Edits are immutable: every change installs a new look object.
 *
 * Transient edits (`commit: false`, a slider or colour picker mid-drag) update the look without
 * an undo step; the next committed edit records one step from where the drag began.
 */

import type { FigureDescriptor } from '../kernel/types';
import { DEFAULT_FIGURE_LOOK_CATALOG } from '../look/catalog';
import {
  type FigureLookColorTarget,
  figureFromLook,
  figureLookKey,
  setFigureLookColor,
  setFigureLookHeight,
  setFigureLookOption,
} from '../look/figure';
import { normalizeFigureLook } from '../look/normalize';
import { type FigureLookPart, randomFigureLook } from '../look/random';
import type {
  FigureLook,
  FigureLookCatalog,
  FigureLookCategoryId,
  FigureLookOutfit,
  FigureLookSteer,
} from '../look/types';

/** What made a look change. */
export type FigureDesignerSource =
  | FigureLookCategoryId
  | 'color'
  | 'height'
  | 'random'
  | 'undo'
  | 'redo'
  | 'external';

export interface FigureDesignerChange {
  source: FigureDesignerSource;
  /** False while a drag is still going: hosts persist only committed changes. */
  committed: boolean;
}

export interface FigureDesignerModelOptions {
  /** Any value: it is normalized (repaired) first. */
  look: unknown;
  catalog?: FigureLookCatalog;
  /** Default 'unspecified'. */
  steer?: FigureLookSteer;
  /** Seeds for "surprise me" (default: crypto random). */
  randomSeed?: () => string;
  /** Undo steps kept (default 50). */
  historyLimit?: number;
}

export type FigureDesignerListener = (
  model: FigureDesignerModel,
  change: FigureDesignerChange,
) => void;

export interface FigureDesignerModel {
  readonly catalog: FigureLookCatalog;
  readonly look: FigureLook;
  readonly steer: FigureLookSteer;
  /** The figure descriptor of the look (with `outfit` worn instead, when set). */
  readonly figure: FigureDescriptor;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /**
   * Show this outfit instead of the look's own (a uniform); edits still change the look. Set by
   * the host, like `setLook`, so it notifies no one.
   */
  outfit: FigureLookOutfit | undefined;
  choose(category: FigureLookCategoryId, optionId: string | null): void;
  setColor(target: FigureLookColorTarget, hex: string, options?: { commit?: boolean }): void;
  setHeight(meters: number, options?: { commit?: boolean }): void;
  /** A new random look; `keep` names the parts to leave as they are. */
  randomize(keep?: readonly FigureLookPart[]): void;
  /** Set by the host (option order and random looks follow it); notifies no one. */
  setSteer(steer: FigureLookSteer): void;
  /** Replace the look from outside (a host's saved value): no undo step and no `onChange`. */
  setLook(look: unknown): void;
  undo(): boolean;
  redo(): boolean;
  subscribe(listener: FigureDesignerListener): () => void;
}

function defaultSeed(): string {
  const bytes = new Uint32Array(2);
  globalThis.crypto.getRandomValues(bytes);
  return `${(bytes[0] as number).toString(36)}${(bytes[1] as number).toString(36)}`;
}

/** Create a designer model around a look. */
export function createFigureDesignerModel(
  options: FigureDesignerModelOptions,
): FigureDesignerModel {
  const catalog = options.catalog ?? DEFAULT_FIGURE_LOOK_CATALOG;
  const limit = options.historyLimit ?? 50;
  const seed = options.randomSeed ?? defaultSeed;
  let look = normalizeFigureLook(options.look, { catalog }).look;
  let steer: FigureLookSteer = options.steer ?? 'unspecified';
  let outfit: FigureLookOutfit | undefined;
  let figure: FigureDescriptor | undefined;
  const past: FigureLook[] = [];
  const future: FigureLook[] = [];
  /** The look before an uncommitted drag began. */
  let dragFrom: FigureLook | undefined;
  const listeners = new Set<FigureDesignerListener>();

  const notify = (change: FigureDesignerChange): void => {
    for (const listener of listeners) listener(model, change);
  };
  const install = (next: FigureLook, change: FigureDesignerChange, record: boolean): void => {
    if (record) {
      past.push(dragFrom ?? look);
      if (past.length > limit) past.shift();
      future.length = 0;
      dragFrom = undefined;
    } else if (!change.committed) dragFrom ??= look;
    look = next;
    figure = undefined;
    notify(change);
  };
  const edit = (next: FigureLook, source: FigureDesignerSource, commit = true): void => {
    if (figureLookKey(next) === figureLookKey(look)) {
      // Nothing changed, but a drag that ends where it last moved still commits its step.
      if (commit && dragFrom !== undefined) {
        past.push(dragFrom);
        if (past.length > limit) past.shift();
        future.length = 0;
        dragFrom = undefined;
        notify({ source, committed: true });
      }
      return;
    }
    install(next, { source, committed: commit }, commit);
  };

  const model: FigureDesignerModel = {
    catalog,
    get look() {
      return look;
    },
    get steer() {
      return steer;
    },
    get figure() {
      figure ??= figureFromLook(look, { catalog, ...(outfit ? { outfit } : {}) });
      return figure;
    },
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
    get outfit() {
      return outfit;
    },
    set outfit(next) {
      outfit = next;
      figure = undefined;
    },
    choose(category, optionId) {
      edit(setFigureLookOption(look, category, optionId, { catalog }), category);
    },
    setColor(target, hex, opts) {
      edit(setFigureLookColor(look, target, hex, { catalog }), 'color', opts?.commit ?? true);
    },
    setHeight(meters, opts) {
      edit(setFigureLookHeight(look, meters, { catalog }), 'height', opts?.commit ?? true);
    },
    randomize(keep) {
      edit(
        randomFigureLook(seed(), {
          catalog,
          steer,
          age: look.person.age,
          ...(keep !== undefined && keep.length > 0 ? { keep: { look, parts: keep } } : {}),
        }),
        'random',
      );
    },
    setSteer(next) {
      steer = next;
    },
    setLook(value) {
      look = normalizeFigureLook(value, { catalog }).look;
      figure = undefined;
      dragFrom = undefined;
    },
    undo() {
      const previous = past.pop();
      if (previous === undefined) return false;
      future.push(look);
      look = previous;
      figure = undefined;
      dragFrom = undefined;
      notify({ source: 'undo', committed: true });
      return true;
    },
    redo() {
      const next = future.pop();
      if (next === undefined) return false;
      past.push(look);
      look = next;
      figure = undefined;
      notify({ source: 'redo', committed: true });
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return model;
}
