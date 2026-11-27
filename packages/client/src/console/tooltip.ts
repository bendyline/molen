// Hover tooltips for the vehicle console: a control's name, how to work it, and the keys that do
// the same. They show for a mouse or pen resting on a control (a thumb has no hover), after a
// short pause, or at once when moving on from one control to the next.

import type { ConsoleTip } from './deck';

/** A rectangle in CSS pixels from the console layer's top-left corner. */
export interface TipRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Milliseconds a pointer rests on a control before its tooltip shows. */
const TIP_DELAY = 450;
/** Milliseconds after a tooltip hides within which the next one shows at once. */
const TIP_WARM = 600;
/** CSS pixels between a tooltip and its control, and kept clear of the layer's edges. */
const TIP_GAP = 8;

const KEY_NAMES: Readonly<Record<string, string>> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Space: 'Space',
  Equal: '=',
  Minus: '−',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num −',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  Escape: 'Esc',
  Backquote: '`',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
};

/** A key code as its keycap reads: `KeyZ` is Z, `ArrowUp` ↑, `ShiftLeft` Shift, `Mouse0` Mouse 1. */
export function keyName(code: string): string {
  const named = KEY_NAMES[code];
  if (named !== undefined) return named;
  const match = /^Key([A-Z])$/.exec(code) ?? /^Digit(\d)$/.exec(code) ?? /^(F\d{1,2})$/.exec(code);
  if (match) return match[1] as string;
  const numpad = /^Numpad(\d)$/.exec(code);
  if (numpad) return `Num ${numpad[1]}`;
  const modifier = /^(Shift|Control|Alt|Meta)(Left|Right)$/.exec(code);
  if (modifier) return modifier[1] === 'Control' ? 'Ctrl' : (modifier[1] as string);
  const mouse = /^Mouse(\d)$/.exec(code);
  if (mouse) return `Mouse ${Number(mouse[1]) + 1}`;
  return code;
}

/** Which of an action's keys a tooltip names: a letter before a digit before anything else. */
const keyRank = (code: string): number => (/^Key/.test(code) ? 0 : /^Digit/.test(code) ? 1 : 2);

/**
 * The keys bound to `actions` in a profile's `bindings` (code to action): one per action, in the
 * order given (a letter where one is bound, so W rather than ↑ and a remapped X rather than the
 * = left beside it), named as on the keycap and without repeats. Actions bound to no key are left
 * out.
 */
export function actionKeys(
  bindings: Readonly<Record<string, string>>,
  actions: readonly string[],
): string[] {
  const keys: string[] = [];
  for (const action of actions) {
    let best: string | undefined;
    for (const [code, bound] of Object.entries(bindings))
      if (bound === action && (best === undefined || keyRank(code) < keyRank(best))) best = code;
    if (best === undefined) continue;
    const name = keyName(best);
    if (!keys.includes(name)) keys.push(name);
  }
  return keys;
}

/**
 * Where a tooltip of `size` goes for a control at `rect` in a layer of `bounds`: centered above
 * it, below it when there is no room above, kept inside the layer.
 */
export function placeTip(
  rect: TipRect,
  size: { width: number; height: number },
  bounds: { width: number; height: number },
): { left: number; top: number } {
  const most = Math.max(TIP_GAP, bounds.width - size.width - TIP_GAP);
  const left = Math.min(most, Math.max(TIP_GAP, rect.left + (rect.width - size.width) / 2));
  const above = rect.top - TIP_GAP - size.height;
  const top = above >= TIP_GAP ? above : rect.top + rect.height + TIP_GAP;
  return { left: Math.round(left), top: Math.round(top) };
}

export interface ConsoleTooltips {
  /**
   * A mouse or pen came to rest on the control `key` (any object naming it), at `rect()` in the
   * layer. The same key again while its tooltip is pending or shown changes nothing.
   */
  enter(key: object, tip: ConsoleTip, rect: () => TipRect): void;
  /** The pointer left `key`. */
  leave(key: object): void;
  /** The control under the pointer was pressed: no tooltip until the pointer leaves it. */
  press(key: object): void;
  /** The control the tooltip is for or waiting on, if any. */
  readonly current: object | undefined;
  hide(): void;
  dispose(): void;
}

/**
 * Tooltips drawn in `layer` (positioned, the console's root). `keys` names the keys bound to
 * actions, read each time a tooltip shows, so remapped keys read right.
 */
export function createConsoleTooltips(
  layer: HTMLElement,
  keys: (actions: readonly string[]) => readonly string[],
): ConsoleTooltips {
  const document = layer.ownerDocument;
  const view = document.defaultView;
  const element = document.createElement('div');
  element.className = 'molen-console-tip';
  // The controls' own labels name them for assistive technology; this repeats them for the eye.
  element.setAttribute('aria-hidden', 'true');
  Object.assign(element.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    maxWidth: '240px',
    padding: '6px 9px 7px',
    borderRadius: '8px',
    border: '1px solid rgb(255 255 255 / 16%)',
    background: 'rgb(14 20 26 / 84%)',
    boxShadow: '0 2px 10px rgb(0 0 0 / 30%)',
    backdropFilter: 'blur(6px)',
    color: '#fff',
    font: '12px/1.35 system-ui, sans-serif',
    pointerEvents: 'none',
    whiteSpace: 'normal',
    zIndex: '3',
    display: 'none',
  });
  layer.append(element);

  let current: object | undefined;
  let pressed: object | undefined;
  let timer: number | undefined;
  let shown = false;
  let hiddenAt = Number.NEGATIVE_INFINITY;
  const now = (): number => view?.performance.now() ?? Date.now();

  const render = (tip: ConsoleTip): void => {
    const head = document.createElement('div');
    Object.assign(head.style, { display: 'flex', alignItems: 'baseline', gap: '10px' });
    const label = document.createElement('span');
    label.textContent = tip.label;
    label.style.fontWeight = '600';
    head.append(label);
    const bound = tip.actions && tip.actions.length > 0 ? keys(tip.actions) : [];
    if (bound.length > 0) {
      const group = document.createElement('span');
      Object.assign(group.style, { display: 'flex', gap: '3px', marginLeft: 'auto' });
      for (const name of bound) {
        const cap = document.createElement('kbd');
        cap.textContent = name;
        Object.assign(cap.style, {
          minWidth: '9px',
          padding: '0 4px',
          border: '1px solid rgb(255 255 255 / 34%)',
          borderRadius: '4px',
          font: '11px/16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          textAlign: 'center',
        });
        group.append(cap);
      }
      head.append(group);
    }
    element.replaceChildren(head);
    if (tip.hint) {
      const hint = document.createElement('div');
      hint.textContent = tip.hint;
      Object.assign(hint.style, { marginTop: '1px', opacity: '0.78' });
      element.append(hint);
    }
  };

  const show = (tip: ConsoleTip, rect: () => TipRect): void => {
    render(tip);
    Object.assign(element.style, { display: 'block', visibility: 'hidden' });
    const place = placeTip(
      rect(),
      { width: element.offsetWidth, height: element.offsetHeight },
      { width: layer.clientWidth, height: layer.clientHeight },
    );
    Object.assign(element.style, {
      left: `${place.left}px`,
      top: `${place.top}px`,
      visibility: 'visible',
    });
    shown = true;
  };

  const cancel = (): void => {
    if (timer !== undefined) view?.clearTimeout(timer);
    timer = undefined;
  };

  const hide = (): void => {
    cancel();
    if (shown) hiddenAt = now();
    shown = false;
    current = undefined;
    element.style.display = 'none';
  };

  return {
    enter(key, tip, rect) {
      if (key === current || key === pressed) return;
      const warm = shown || now() - hiddenAt < TIP_WARM;
      hide();
      current = key;
      if (warm) show(tip, rect);
      else
        timer = view?.setTimeout(() => {
          timer = undefined;
          if (current === key) show(tip, rect);
        }, TIP_DELAY);
    },
    leave(key) {
      if (key === pressed) pressed = undefined;
      if (key === current) hide();
    },
    press(key) {
      pressed = key;
      if (key === current) {
        // A press is not a move on to the next control: the next tooltip waits again.
        hide();
        hiddenAt = Number.NEGATIVE_INFINITY;
      }
    },
    get current() {
      return current;
    },
    hide,
    dispose() {
      hide();
      element.remove();
    },
  };
}
