import type { Bounds2 } from './geometry2d';
import { interiorToLocal } from './interior-site';
import type {
  BuildingOpening,
  InteriorCell,
  InteriorElevator,
  InteriorPlan,
  InteriorProfile,
  InteriorStorey,
  InteriorTowerPlan,
} from './interior-types';
import type { MeshBufferBuilder } from './mesh-buffers';
import { parseColor } from './schema-common';
import type { Vec2, Vec3 } from './types';
import { buildWalls } from './walls';

export type InteriorBox = (
  out: MeshBufferBuilder,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: string,
  material?: string,
) => void;

const WALL = 0.12;
const DOOR = 1.1;
const DOOR_HEIGHT = 2.2;
const SILL = 0.85;
const HEADER = 0.4;
const BAY = 3.2;
const PIER = 0.5;

/** A ribbon of glazed bays for one storey: the shell is seen through from inside, not cut. */
function windowBays(site: InteriorPlan['site'], storey: InteriorStorey): BuildingOpening[] {
  const openings: BuildingOpening[] = [];
  const { outline } = site;
  for (let edge = 0; edge < outline.length; edge++) {
    const a = outline[edge] as Vec2,
      b = outline[(edge + 1) % outline.length] as Vec2;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 2) continue;
    const bays = Math.max(1, Math.round((length - PIER) / BAY));
    const stride = (length - PIER) / bays;
    for (let bay = 0; bay < bays; bay++)
      openings.push({
        edge,
        start: PIER + bay * stride,
        end: (bay + 1) * stride,
        bottom: storey.floor + SILL,
        top: storey.ceiling - HEADER,
        kind: 'window',
      });
  }
  return openings;
}

function glaze(
  site: InteriorPlan['site'],
  openings: readonly BuildingOpening[],
  out: MeshBufferBuilder,
): void {
  for (const opening of openings) {
    if (opening.kind !== 'window') continue;
    const a = site.outline[opening.edge] as Vec2,
      b = site.outline[(opening.edge + 1) % site.outline.length] as Vec2;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = (b[0] - a[0]) / length,
      dz = (b[1] - a[1]) / length;
    const p = (s: number, y: number): Vec3 => [a[0] + dx * s, y, a[1] + dz * s];
    out.addQuad(
      'window',
      'palette:#ffffff',
      [
        p(opening.start, opening.bottom),
        p(opening.end, opening.bottom),
        p(opening.end, opening.top),
        p(opening.start, opening.top),
      ],
      [dz, 0, -dx],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      [0.88, 0.94, 0.95],
    );
  }
}

/** The floor, ceiling and outer wall of one storey, shared by every plated building. */
export function buildPlate(
  plan: InteriorPlan,
  storey: InteriorStorey,
  ground: boolean,
  next: InteriorStorey | undefined,
  voids: readonly Vec2[][],
  voidsAbove: readonly Vec2[][],
  palette: InteriorProfile['palette'],
  structure: MeshBufferBuilder,
  glass: MeshBufferBuilder,
  floorMaterial = 'interior:bright-ceramic',
): void {
  const site = plan.site;
  structure.addCap(
    'wall',
    floorMaterial,
    site.outline,
    [...site.holes, ...voids],
    () => storey.floor,
    [0, 1, 0],
    (p) => interiorToLocal(site, p),
    parseColor(palette.floor),
  );
  structure.addCap(
    'wall',
    'interior:bright-plaster',
    site.outline,
    [...site.holes, ...voidsAbove],
    () => storey.ceiling,
    [0, -1, 0],
    (p) => p,
    parseColor('#eee9dc'),
  );
  const openings = ground ? site.openings : windowBays(site, storey);
  buildWalls(
    [site.outline, ...site.holes],
    storey.floor - 0.04,
    next ? next.floor : storey.ceiling + 0.12,
    { mode: 'meters', bayWidth: 1, floorHeight: 3, offsetU: 0, offsetV: 0, mirror: false },
    { slot: 'wall', ref: 'interior:bright-plaster', color: parseColor(palette.wall) },
    undefined,
    structure,
    storey.floor - 0.04,
    openings,
    true,
  );
  if (!ground) glaze(site, openings, glass);
}

/** Walls of one room: solid but for a door on its corridor side. */
function buildCell(
  cell: InteriorCell,
  elevation: number,
  height: number,
  drawn: Set<string>,
  structure: MeshBufferBuilder,
  box: InteriorBox,
  color: string,
): void {
  const [x0, z0, x1, z1] = cell.bounds;
  const wall = (x: number, z: number, w: number, d: number): void => {
    const key = `${x.toFixed(2)}:${z.toFixed(2)}:${w.toFixed(2)}:${d.toFixed(2)}`;
    if (drawn.has(key)) return;
    drawn.add(key);
    box(structure, x, elevation + height / 2, z, w, height, d, color);
  };
  const sides: ['x-' | 'x+' | 'z-' | 'z+', number, number, number, number][] = [
    ['x-', x0, (z0 + z1) / 2, WALL, z1 - z0],
    ['x+', x1, (z0 + z1) / 2, WALL, z1 - z0],
    ['z-', (x0 + x1) / 2, z0, x1 - x0, WALL],
    ['z+', (x0 + x1) / 2, z1, x1 - x0, WALL],
  ];
  for (const [side, x, z, w, d] of sides) {
    if (side !== cell.facing) {
      wall(x, z, w, d);
      continue;
    }
    // Either side of the door, with a header over it.
    const along = w > d;
    const span = along ? w : d;
    const piece = (span - DOOR) / 2;
    for (const direction of [-1, 1]) {
      const offset = direction * (DOOR / 2 + piece / 2);
      if (along) wall(x + offset, z, piece, d);
      else wall(x, z + offset, w, piece);
    }
    const lintel = height - DOOR_HEIGHT;
    if (lintel > 0) {
      const key = `h:${x.toFixed(2)}:${z.toFixed(2)}`;
      if (!drawn.has(key)) {
        drawn.add(key);
        box(
          structure,
          x,
          elevation + DOOR_HEIGHT + lintel / 2,
          z,
          along ? DOOR : WALL,
          lintel,
          along ? WALL : DOOR,
          color,
        );
      }
    }
  }
}

/** A lift car with its back and sides closed, open toward the lobby, and call buttons outside. */
function buildCar(
  car: InteriorElevator,
  elevation: number,
  height: number,
  structure: MeshBufferBuilder,
  furniture: MeshBufferBuilder,
  box: InteriorBox,
): void {
  const [x0, z0, x1, z1] = car.bounds;
  const steel = '#9aa3a8';
  const y = elevation + height / 2;
  const openX = car.facing === 'x-' || car.facing === 'x+';
  const w = x1 - x0,
    d = z1 - z0;
  for (const [side, x, z, sx, sz] of [
    ['x-', x0, (z0 + z1) / 2, WALL, d],
    ['x+', x1, (z0 + z1) / 2, WALL, d],
    ['z-', (x0 + x1) / 2, z0, w, WALL],
    ['z+', (x0 + x1) / 2, z1, w, WALL],
  ] as const) {
    if (side === car.facing) continue;
    box(structure, x, y, z, sx, height, sz, steel, 'interior:plain');
  }
  // Door reveals and a lit panel beside them.
  const front = car.facing === 'x-' ? x0 : car.facing === 'x+' ? x1 : car.facing === 'z-' ? z0 : z1;
  const reveal = (w > d ? w : d) * 0.15;
  for (const side of [-1, 1]) {
    if (openX)
      box(
        structure,
        front,
        y,
        (z0 + z1) / 2 + side * (d / 2 - reveal / 2),
        WALL,
        height,
        reveal,
        steel,
        'interior:plain',
      );
    else
      box(
        structure,
        (x0 + x1) / 2 + side * (w / 2 - reveal / 2),
        y,
        front,
        reveal,
        height,
        WALL,
        steel,
        'interior:plain',
      );
  }
  if (openX)
    box(
      furniture,
      front,
      elevation + 2.5,
      (z0 + z1) / 2,
      0.14,
      0.2,
      0.9,
      '#ffb94a',
      'interior:lamp',
    );
  else
    box(
      furniture,
      (x0 + x1) / 2,
      elevation + 2.5,
      front,
      0.9,
      0.2,
      0.14,
      '#ffb94a',
      'interior:lamp',
    );
}

function corridorLights(
  corridors: readonly Bounds2[],
  elevation: number,
  furniture: MeshBufferBuilder,
  box: InteriorBox,
): void {
  for (const [x0, z0, x1, z1] of corridors) {
    const alongX = x1 - x0 > z1 - z0;
    const length = alongX ? x1 - x0 : z1 - z0;
    const count = Math.max(1, Math.floor(length / 5));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      if (alongX)
        box(
          furniture,
          x0 + (x1 - x0) * t,
          elevation,
          (z0 + z1) / 2,
          1,
          0.05,
          0.3,
          '#fff4d6',
          'interior:lamp',
        );
      else
        box(
          furniture,
          (x0 + x1) / 2,
          elevation,
          z0 + (z1 - z0) * t,
          0.3,
          0.05,
          1,
          '#fff4d6',
          'interior:lamp',
        );
    }
  }
}

/** Walls, rooms and lift cars of each built storey. */
export function* buildTowerStructure(
  plan: InteriorPlan,
  structure: MeshBufferBuilder,
  glass: MeshBufferBuilder,
  furniture: MeshBufferBuilder,
  box: InteriorBox,
  palette: InteriorProfile['palette'],
): Generator<void, void, void> {
  const site = plan.site;
  const tower = plan.tower as InteriorTowerPlan;
  const all = site.storeys ?? plan.storeys;
  for (const [index, storey] of plan.storeys.entries()) {
    const level = tower.levels[index] as number;
    buildPlate(plan, storey, level === 0, all[level + 1], [], [], palette, structure, glass);
    const elevation = storey.floor - site.floor;
    const height = storey.ceiling - storey.floor;
    const drawn = new Set<string>();
    for (const cell of tower.cells) {
      if (cell.open || (level === 0 && cell.upperOnly)) continue;
      buildCell(cell, elevation, height, drawn, structure, box, palette.wall);
    }
    for (const car of tower.elevators) buildCar(car, elevation, height, structure, furniture, box);
    corridorLights(tower.corridors, elevation + height - 0.04, furniture, box);
    yield;
  }
}
