import {
  defineComponent,
  type JsonObject,
  spawnFromData,
  type World,
  type WorldSetup,
} from '@bendyline/molen-kernel';
import data from '../data.json';

// A data-driven 3D bar chart — the first non-game slice. Each datum binds to a bar entity;
// a kernel system animates the bars growing from the ground (entrance), so frames differ over
// time and a camera track can orbit. No rendering logic here — just ECS data + a system.

interface Datum {
  label: string;
  value: number;
}
export const DATA = data as Datum[];

const SPACING = 2.4;
const BAR_W = 1.4;
const HEIGHT_SCALE = 0.9;
const GROW_TICKS = 36; // ~1.2s at 30Hz

interface Bar extends JsonObject {
  target: number;
  t: number;
  x: number;
}
const BarC = defineComponent<Bar>('bar');
const Transform = defineComponent<{
  pos: [number, number, number];
  rot: [number, number, number, number];
  scale?: [number, number, number];
}>('transform');

function colorFor(value: number, max: number): string {
  // low -> teal, high -> magenta
  const t = max > 0 ? value / max : 0;
  const lerp = (a: number, b: number): number => Math.round(a + (b - a) * t);
  const r = lerp(0x2a, 0xe6);
  const g = lerp(0xb8, 0x39);
  const b = lerp(0xa0, 0x9a);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** The visualization setup: bind the dataset to bars + a grow-animation system. */
export const setup: WorldSetup = (world: World): void => {
  const max = Math.max(...DATA.map((d) => d.value));
  const offset = ((DATA.length - 1) * SPACING) / 2;

  spawnFromData(
    world,
    DATA,
    (d, i) => {
      const x = i * SPACING - offset;
      return {
        transform: { pos: [x, 0, 0], rot: [0, 0, 0, 1], scale: [BAR_W, 0.001, BAR_W] },
        bar: { target: d.value, t: 0, x },
        renderable: {
          kind: 'primitive',
          ref: 'box',
          materialRef: `palette:${colorFor(d.value, max)}`,
        },
      };
    },
    { idPrefix: 'bar-' },
  );

  world.addSystem(
    (w, ctx) => {
      for (const [id, bar] of w.query(BarC)) {
        if (bar.t >= 1) continue;
        const t = Math.min(1, bar.t + ctx.dt / (GROW_TICKS / w.tickRate));
        const h = bar.target * HEIGHT_SCALE * easeOut(t);
        w.patch(id, Transform, {
          pos: [bar.x, h / 2, 0],
          scale: [BAR_W, Math.max(0.001, h), BAR_W],
        });
        w.patch(id, BarC, { t });
      }
    },
    { name: 'grow' },
  );
};

export default setup;
