import type { HudData, JsonValue, PlayCondition } from '@bendyline/molen-schema';
import { parseValueRef } from '@bendyline/molen-schema';

// The scene `hud` block, evaluated against synced component state and drawn as a DOM overlay.
// Pure evaluation (`evaluateHud`) is separate from drawing (`createHudOverlay`) so a host can
// test or render it its own way. The HUD never enters the state hash. Three-free subpath.

/** Reads one component of one entity from whatever state the host holds. */
export type HudReader = (entity: string, component: string) => JsonValue | undefined;

export interface HudState {
  items: { label: string; text: string }[];
  message?: { text: string; detail?: string };
  caption?: string;
  title?: string;
}

function readRef(ref: string, read: HudReader): JsonValue | undefined {
  const parsed = parseValueRef(ref);
  if (parsed === null) return undefined;
  let cur: JsonValue | undefined = read(parsed.entity, parsed.component);
  for (const seg of parsed.path) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = Array.isArray(cur)
      ? typeof seg === 'number'
        ? cur[seg]
        : undefined
      : (cur as { [k: string]: JsonValue })[String(seg)];
  }
  return cur;
}

function holds(cond: PlayCondition, read: HudReader): boolean {
  const actual = readRef(cond.select, read);
  const expected = cond.value;
  const op = cond.op.replace(/^(all_|any_)/, '');
  if (op === 'exists') return actual !== undefined;
  if (op === 'eq') return JSON.stringify(actual) === JSON.stringify(expected);
  if (typeof actual !== 'number' || typeof expected !== 'number') return false;
  switch (op) {
    case 'approx':
      return Math.abs(actual - expected) <= (cond.tol ?? 1e-6);
    case 'gt':
      return actual > expected;
    case 'gte':
      return actual >= expected;
    case 'lt':
      return actual < expected;
    case 'lte':
      return actual <= expected;
    default:
      return false;
  }
}

function show(value: JsonValue | undefined): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(1);
  if (typeof value === 'string' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/** What the HUD shows at a tick: readouts, the first message whose condition holds, captions. */
export function evaluateHud(hud: HudData, read: HudReader, tick: number): HudState {
  const state: HudState = {
    items: (hud.items ?? []).map((item) => ({
      label: item.label,
      text: show(readRef(item.value, read)),
    })),
  };
  const message = (hud.messages ?? []).find((m) => holds(m.when, read));
  if (message !== undefined) {
    state.message = {
      text: message.text,
      ...(message.detail !== undefined ? { detail: message.detail } : {}),
    };
  }
  const caption = (hud.captions ?? []).find((c) => tick >= c.tick && tick < c.tick + c.ticks);
  if (caption !== undefined) state.caption = caption.text;
  if (hud.title !== undefined && tick < (hud.title.ticks ?? 90)) state.title = hud.title.text;
  return state;
}

export interface HudOverlay {
  update(state: HudState): void;
  dispose(): void;
}

/**
 * Draw HUD state over a container (positioned relative). Inherits the page's font; colors stay
 * readable over any scene (light text with a soft shadow on translucent panels).
 */
export function createHudOverlay(container: HTMLElement): HudOverlay {
  const doc = container.ownerDocument;
  const root = doc.createElement('div');
  root.setAttribute('data-molen-hud', '');
  root.style.cssText =
    'position:absolute;inset:0;pointer-events:none;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6);font:inherit;';
  const items = doc.createElement('div');
  items.style.cssText =
    'position:absolute;top:12px;left:12px;display:flex;gap:16px;padding:6px 10px;border-radius:6px;background:rgba(0,0,0,.35);';
  const center = doc.createElement('div');
  center.style.cssText =
    'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6px;';
  const big = doc.createElement('div');
  big.style.cssText = 'font-size:2em;font-weight:600;';
  const small = doc.createElement('div');
  small.style.cssText = 'font-size:1em;opacity:.9;';
  center.append(big, small);
  const caption = doc.createElement('div');
  caption.style.cssText =
    'position:absolute;left:10%;right:10%;bottom:6%;text-align:center;font-size:1.25em;';
  root.append(items, center, caption);
  container.append(root);
  let last = '';
  return {
    update(state) {
      const key = JSON.stringify(state);
      if (key === last) return;
      last = key;
      items.replaceChildren(
        ...state.items.map((item) => {
          const el = doc.createElement('span');
          el.textContent = `${item.label} ${item.text}`;
          return el;
        }),
      );
      items.style.display = state.items.length > 0 ? 'flex' : 'none';
      const headline = state.message?.text ?? state.title ?? '';
      big.textContent = headline;
      small.textContent = state.message?.detail ?? '';
      center.style.display = headline === '' ? 'none' : 'flex';
      caption.textContent = state.caption ?? '';
    },
    dispose() {
      root.remove();
    },
  };
}
