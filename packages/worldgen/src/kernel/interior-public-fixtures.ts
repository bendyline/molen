import type { InteriorFurniture } from './interior-types';

type Put = (
  dx: number,
  y: number,
  dz: number,
  sx: number,
  sy: number,
  sz: number,
  color: string,
  material?: string,
) => void;

const LIT = 'interior:lamp';

/** Fixtures of public buildings, in the fixture's own frame; +Z runs away from the entrance. */
export function buildPublicFixture(
  kind: InteriorFurniture,
  variant: number,
  w: number,
  d: number,
  ceiling: number,
  wood: string,
  accent: string,
  metal: string,
  put: Put,
): boolean {
  switch (kind) {
    case 'reception':
      put(0, 0.52, 0, w, 1.04, d, accent);
      put(0, 1.08, 0, w + 0.08, 0.06, d + 0.08, '#e8e4d8');
      put(0, 1.5, d / 2 + 0.3, w * 0.8, 1.6, 0.08, wood);
      return true;
    case 'seat-row': {
      put(0, 0.44, 0, w, 0.1, d * 0.7, accent, 'interior:fabric');
      put(0, 0.72, -d * 0.3, w, 0.62, 0.1, accent, 'interior:fabric');
      const seats = Math.max(1, Math.round(w / 0.6));
      for (let i = 0; i <= seats; i++)
        put(-w / 2 + (i * w) / seats, 0.3, 0, 0.05, 0.6, d * 0.7, '#262a2e');
      return true;
    }
    case 'pew':
      put(0, 0.45, 0, w, 0.07, d * 0.7, wood);
      put(0, 0.72, -d * 0.32, w, 0.6, 0.06, wood);
      for (const side of [-1, 1]) put((side * w) / 2, 0.45, 0, 0.07, 0.9, d, wood);
      return true;
    case 'altar':
      put(0, 0.18, 0, w, 0.36, d, wood);
      put(0, 0.9, -d * 0.1, w * 0.38, 1.05, 0.8, '#e8e0cf');
      put(
        0,
        Math.min(ceiling * 0.5, 4),
        d / 2 - 0.1,
        w * 0.5,
        Math.min(ceiling * 0.6, 5),
        0.1,
        accent,
      );
      return true;
    case 'screen':
      put(0, 0.3, -0.4, w, 0.6, d - 0.8, wood);
      put(0, ceiling * 0.56, d / 2 - 0.1, w * 1.1, ceiling * 0.62, 0.08, '#f4f3ec', LIT);
      return true;
    case 'plinth': {
      put(0, 0.5, 0, w, 1, d, '#dfdcd2');
      if (variant % 2 === 0) put(0, 1.35, 0, w * 0.45, 0.7, d * 0.45, accent);
      else put(0, 1.3, 0, w * 0.7, 0.6, d * 0.25, metal);
      return true;
    }
    case 'painting': {
      put(0, 1.7, 0, w, 1.4, 0.06, '#3a2c20');
      const colors = ['#7b6c54', '#35506b', '#8a4c3c', '#4f6b52'];
      put(0, 1.7, -0.04, w * 0.92, 1.26, 0.03, colors[variant % 4] as string);
      return true;
    }
    case 'court-lines': {
      put(0, 0.02, 0, w, 0.03, d, '#c79a62', 'interior:wood');
      const line = '#f3efe2';
      for (const dz of [-d / 2 + 0.05, d / 2 - 0.05, 0]) put(0, 0.04, dz, w, 0.01, 0.08, line);
      for (const dx of [-w / 2 + 0.05, w / 2 - 0.05]) put(dx, 0.04, 0, 0.08, 0.01, d, line);
      for (const dz of [-d / 2 + 2.9, d / 2 - 2.9]) put(0, 0.04, dz, 3.6, 0.01, 0.08, line);
      return true;
    }
    case 'hoop': {
      const inward = variant === 0 ? 1 : -1;
      put(0, 1.6, -inward * 0.2, 0.14, 3.2, 0.14, metal);
      put(0, 3.3, 0, 1.8, 1.05, 0.05, '#f2f2ee');
      put(0, 3.05, inward * 0.3, 0.46, 0.03, 0.46, '#d0562a');
      return true;
    }
    case 'bleacher': {
      const tiers = Math.max(2, Math.min(6, Math.floor(w / 0.8)));
      for (let tier = 0; tier < tiers; tier++) {
        const depth = w / tiers;
        put(
          w / 2 - depth * (tier + 0.5),
          0.25 + tier * 0.22,
          0,
          depth,
          0.5 + tier * 0.44,
          d,
          tier % 2 ? accent : wood,
        );
      }
      return true;
    }
    case 'ticket-gate':
      put(0, 0.5, 0, 0.26, 1, d, metal);
      put(0, 0.9, -d * 0.2, w, 0.05, 0.05, accent);
      return true;
    case 'fire-engine': {
      const red = ['#b3261e', '#a82219', '#bd2c22'][variant % 3] as string;
      put(0, 1.5, d * 0.08, w, 1.8, d * 0.82, red);
      put(0, 1.7, -d * 0.4, w, 2.1, d * 0.18, red);
      put(0, 2.2, -d * 0.45, w * 0.86, 0.7, 0.06, '#2a3a44');
      put(0, 0.55, 0, w * 0.98, 0.5, d * 0.97, '#23262a');
      put(0, 2.55, d * 0.1, w * 0.3, 0.25, d * 0.7, metal);
      put(0, 2.3, -d * 0.32, w * 0.8, 0.12, 0.25, '#e24a3b', LIT);
      return true;
    }
    case 'planter':
      put(0, 0.3, 0, w, 0.6, d, '#8a8478');
      put(0, 0.95, 0, w * 0.8, 0.9, d * 0.8, '#3f6a42');
      put(0, 1.5, 0, w * 0.45, 0.7, d * 0.45, '#4c7c4c');
      return true;
    default:
      return false;
  }
}
