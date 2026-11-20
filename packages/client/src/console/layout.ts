// Where the vehicle console's items go on a screen: the stick and what goes with it on the
// left, the throttle at the right edge with the handles in from it, dials between. Items go in
// order of importance; what does not fit in the bottom row waits for a row above (a portrait
// phone, a tablet) or behind the "more controls" drawer (a landscape phone, where a second row
// would cover the view).

import type { ConsoleRect } from './strip';

export interface ConsoleLayoutItem {
  id: string;
  side: 'left' | 'right' | 'middle';
  /** Width and height on a phone, CSS pixels. */
  size: readonly [number, number];
  /** On a phone, placed only while the drawer is open. */
  drawer?: boolean;
  /** Lower goes first (default: its place in the list). The stick always goes first. */
  priority?: number;
}

export interface ConsoleLayoutInput {
  /** The container's size, CSS pixels. */
  width: number;
  height: number;
  items: readonly ConsoleLayoutItem[];
  /** Safe areas to keep clear (a phone's notch and home indicator), CSS pixels. */
  insets?: { left?: number; right?: number; bottom?: number };
  /** Left-handed: the stick on the right and the throttle on the left. */
  mirror?: boolean;
  drawerOpen?: boolean;
}

export interface ConsoleLayout {
  /** `tablet` once the shorter side is 600 CSS pixels or more; its parts are a quarter larger. */
  size: 'phone' | 'tablet';
  scale: number;
  /** Height of the strip from the container's bottom edge, CSS pixels. */
  height: number;
  /** Each placed item's rectangle, from the container's top-left corner. */
  rects: Map<string, ConsoleRect>;
  /** Items there was no room for (or behind a closed drawer). */
  hidden: string[];
  /** Whether some items wait behind the drawer, so the button that opens it is needed. */
  drawer: boolean;
  /**
   * The touch stick's box: `side` is CSS `left` (or `right`, mirrored), with `bottom` and its
   * size.
   */
  stick: { side: number; bottom: number; size: number };
  /** Room the console takes from each side along the bottom edge, CSS pixels. */
  left: number;
  right: number;
}

/** The touch stick's box (`createTouchJoystick` with its default 56 px radius). */
const STICK_BOX = 144;

export function layoutConsole(input: ConsoleLayoutInput): ConsoleLayout {
  const { width, height } = input;
  const tablet = Math.min(width, height) >= 600;
  const portrait = height > width;
  const scale = tablet ? 1.25 : 1;
  const gap = 6 * scale;
  const insetLeft = input.insets?.left ?? 0;
  const insetRight = input.insets?.right ?? 0;
  const insetBottom = input.insets?.bottom ?? 0;
  const startLeft = insetLeft + 16;
  const startRight = width - insetRight - 10;
  const base = insetBottom + 8;
  // A landscape phone keeps one row and a portrait one two: more would cover the middle of the
  // view. What does not fit waits behind the drawer.
  const rows = tablet || portrait ? 2 : 1;
  const sized = (item: ConsoleLayoutItem): [number, number] => [
    Math.round(item.size[0] * scale),
    Math.round(item.size[1] * scale),
  ];
  const order = new Map(input.items.map((item, index) => [item, item.priority ?? index]));
  const byPriority = (a: ConsoleLayoutItem, b: ConsoleLayoutItem): number =>
    (order.get(a) ?? 0) - (order.get(b) ?? 0);
  const drawerItems = tablet ? [] : input.items.filter((item) => item.drawer);
  const placed = new Map<string, { x: number; bottom: number; w: number; h: number }>();
  const spanOf = (items: readonly [number, number][]): number =>
    items.reduce((sum, [w]) => sum + w, 0) + gap * Math.max(0, items.length - 1);

  /** One row, most important first; returns what did not fit. */
  const row = (bottom: number, items: readonly ConsoleLayoutItem[]): ConsoleLayoutItem[] => {
    let left = startLeft;
    let right = startRight;
    const overflow: ConsoleLayoutItem[] = [];
    const middle: { item: ConsoleLayoutItem; size: [number, number] }[] = [];
    const middleWidth = (): number => spanOf(middle.map(({ size }) => size));
    const stick = items.find((item) => item.id === 'stick');
    if (stick) {
      const [w, h] = sized(stick);
      placed.set(stick.id, { x: left, bottom, w, h });
      left += w + gap;
    }
    let dials: boolean | undefined;
    for (const item of items) {
      if (item === stick) continue;
      const [w, h] = sized(item);
      if (item.side === 'middle') {
        // The dials go together: all of them in this row, or all in the next.
        if (dials === undefined) {
          const all = items.filter((other) => other.side === 'middle');
          dials = spanOf(all.map(sized)) <= right - left;
          if (dials) for (const other of all) middle.push({ item: other, size: sized(other) });
        }
        if (!dials) overflow.push(item);
        continue;
      }
      // A side item may not take the room more important dials have already been given.
      const reserve = middle.length > 0 ? middleWidth() + gap : 0;
      if (w > right - left - reserve) {
        overflow.push(item);
        continue;
      }
      if (item.side === 'left') {
        placed.set(item.id, { x: left, bottom, w, h });
        left += w + gap;
      } else {
        placed.set(item.id, { x: right - w, bottom, w, h });
        right -= w + gap;
      }
    }
    let x = left + (right - left - middleWidth()) / 2;
    for (const { item, size } of middle) {
      placed.set(item.id, { x, bottom, w: size[0], h: size[1] });
      x += size[0] + gap;
    }
    return overflow;
  };

  let pending = input.items.filter((item) => !drawerItems.includes(item)).sort(byPriority);
  let bottom = base;
  const next = (): void => {
    // The next row starts over the tallest item placed so far.
    const tops = [...placed].map(([, rect]) => rect.bottom + rect.h);
    bottom = (tops.length > 0 ? Math.max(...tops) : base) + gap;
  };
  for (let index = 0; index < rows && pending.length > 0; index++) {
    const count = placed.size;
    pending = row(bottom, pending);
    if (placed.size === count) break;
    next();
  }
  // What is left, and a phone's drawer items, wait behind the drawer.
  const behind = [...pending, ...drawerItems].sort(byPriority);
  if (input.drawerOpen && behind.length > 0) {
    // An open drawer is a row of its own above the rest, from the throttle side.
    row(
      bottom,
      behind.map((item) => ({ ...item, side: 'right' as const })),
    );
  }

  const rects = new Map<string, ConsoleRect>();
  let strip = 0;
  let leftExtent = 0;
  let rightExtent = 0;
  for (const [id, rect] of placed) {
    const x = input.mirror ? width - rect.x - rect.w : rect.x;
    rects.set(id, { left: x, top: height - rect.bottom - rect.h, width: rect.w, height: rect.h });
    strip = Math.max(strip, rect.bottom + rect.h);
    if (rect.bottom === base) {
      if (x + rect.w / 2 < width / 2) leftExtent = Math.max(leftExtent, x + rect.w);
      else rightExtent = Math.max(rightExtent, width - x);
    }
  }
  const stickRect = placed.get('stick');
  const stickSide = stickRect ? stickRect.x + (stickRect.w - STICK_BOX) / 2 : insetLeft + 24;
  return {
    size: tablet ? 'tablet' : 'phone',
    scale,
    height: Math.ceil(strip),
    rects,
    hidden: input.items.filter((item) => !placed.has(item.id)).map((item) => item.id),
    drawer: behind.length > 0,
    // From the stick's own edge of the screen: the left, or the right when mirrored.
    stick: {
      side: stickSide,
      bottom: stickRect ? stickRect.bottom + 16 : insetBottom + 24,
      size: STICK_BOX,
    },
    left: Math.ceil(leftExtent),
    right: Math.ceil(rightExtent),
  };
}
