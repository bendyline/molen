import {
  type ArchStyleDoc,
  type BuildingYard,
  hashString,
  unit01,
  type Vec2,
} from '@bendyline/molen-worldgen/kernel';

interface YardInput {
  identity: string;
  style?: ArchStyleDoc;
  width: number;
  halfLot: number;
  front: number;
  back: number;
  curb: number;
  hasGarage: boolean;
  entrances: Array<{ x: number; width: number }>;
  at(x: number, z: number): Vec2;
  /** Whether a fence segment or an optional driveway remains clear of mapped corridors. */
  clear(a: Vec2, b: Vec2, padding: number, driveway: boolean): boolean;
}

/** Decoration draws use their own salt: adding yards never moves or reshuffles existing houses. */
export function createFrontageYard(input: YardInput): BuildingYard {
  const { at } = input,
    hash = hashString(`${input.identity}|yard`),
    yard: BuildingYard = {};
  const openings = [...input.entrances];
  if (!input.hasGarage) {
    const width = Math.min(3.1, input.width * 0.3);
    const entranceX = input.entrances[0]?.x ?? 0;
    const side = Math.abs(entranceX) > 0.1 ? -Math.sign(entranceX) : unit01(hash, 0) < 0.5 ? -1 : 1;
    const x = side * Math.min(input.width * 0.26, input.width / 2 - width / 2 - 0.15);
    const from = at(x, input.curb),
      to = at(x, -0.12);
    if (width >= 2 && input.clear(from, to, width / 2, true)) {
      // The Earth landcover overlay sits 0.18 m above terrain; keep the paving visible.
      yard.driveway = { from, to, width, lift: 0.28 };
      openings.push({ x, width });
    }
  }
  const choices = input.style?.lotFences ?? [
    { kind: 'none', weight: 5 },
    { kind: 'timber', weight: 2 },
    { kind: 'masonry', weight: 1 },
    { kind: 'rail', weight: 2 },
  ];
  let draw = unit01(hash, 1) * choices.reduce((sum, c) => sum + c.weight, 0);
  const selected =
    choices.find((c) => {
      draw -= c.weight;
      return draw < 0;
    })?.kind ?? 'none';
  if (selected === 'none') return yard;
  const segments: Array<[Vec2, Vec2]> = [];
  const append = (a: Vec2, b: Vec2): void => {
    if (input.clear(a, b, 0.22, false)) segments.push([a, b]);
  };
  const left = -input.halfLot,
    right = input.halfLot;
  append(at(left, input.front), at(left, input.back));
  append(at(left, input.back), at(right, input.back));
  append(at(right, input.back), at(right, input.front));
  // Some yards keep the entire front open; others reserve separate path/driveway gaps.
  if (unit01(hash, 2) < 0.68) {
    let start = left;
    const gaps = openings
      .map((o) => [o.x - o.width / 2 - 0.45, o.x + o.width / 2 + 0.45] as Vec2)
      .sort((a, b) => a[0] - b[0]);
    for (const [lo, hi] of gaps) {
      const end = Math.min(right, lo);
      if (end - start >= 0.45) append(at(start, input.front), at(end, input.front));
      start = Math.max(start, hi);
    }
    if (right - start >= 0.45) append(at(start, input.front), at(right, input.front));
  }
  if (segments.length)
    yard.fence = {
      kind: selected,
      height: (selected === 'masonry' ? 0.75 : 0.85) + unit01(hash, 3) * 0.35,
      segments,
    };
  return yard;
}
