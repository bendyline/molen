import { z } from 'zod';
import type { TerrainRoadSignProfile } from './road-sign-styles';
import type { TerrainTransportationFeature } from './semantic-types';

/** Normalized vector artwork. Content supplies identities; the renderer supplies real font legends. */
const box = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().positive(),
  z.number().positive(),
]);
const color = z.string().regex(/^#[\da-f]{6}$/i);
const layer = z
  .strictObject({
    color,
    positions: z.array(z.number().finite().min(-2).max(2)).min(6).max(200_000),
    indices: z.array(z.number().int().nonnegative()).min(3).max(300_000),
  })
  .superRefine((value, ctx) => {
    if (
      value.positions.length % 2 ||
      value.indices.length % 3 ||
      value.indices.some((i) => i >= value.positions.length / 2)
    )
      ctx.addIssue({ code: 'custom', message: 'Invalid route shield triangles' });
  });
type ShieldTextBox = [number, number, number, number];
export interface TerrainRouteShieldLibrary {
  format: 'molen/route-shields@1';
  shields: Record<
    string,
    {
      title: string;
      subdivision: string;
      variants: {
        aspect: number;
        layers: { color: string; positions: number[]; indices: number[] }[];
        textBox: ShieldTextBox;
        textColor: string;
        legends: { text: string; box: ShieldTextBox; color: string }[];
      }[];
    }
  >;
}
export const terrainRouteShieldLibrarySchema: z.ZodType<TerrainRouteShieldLibrary> = z.strictObject(
  {
    format: z.literal('molen/route-shields@1'),
    shields: z.record(
      z.string().min(1),
      z.strictObject({
        title: z.string().min(1),
        subdivision: z.string().regex(/^US-[A-Z]{2}$/),
        variants: z
          .array(
            z.strictObject({
              aspect: z.number().positive().max(4),
              layers: z.array(layer).min(1).max(100),
              textBox: box,
              textColor: color,
              legends: z.array(z.strictObject({ text: z.string().max(40), box, color })).max(8),
            }),
          )
          .min(1)
          .max(2),
      }),
    ),
  },
);
export interface TerrainRouteMarker {
  network: string;
  ref: string;
}

/** Exact networks only: never turn a county, federal, secondary, toll or business route into a primary state route. */
export function resolveTerrainRouteMarker(
  road: Pick<TerrainTransportationFeature, 'network' | 'shieldText' | 'ref'>,
  profile: Readonly<TerrainRoadSignProfile>,
  library?: TerrainRouteShieldLibrary,
): { marker: TerrainRouteMarker; evidence: string[] } | undefined {
  if (!library) return undefined;
  let network = road.network?.trim();
  const evidence: string[] = [];
  if (network) {
    if (!Object.hasOwn(library.shields, network)) return undefined;
    evidence.push(`network=${network}`);
  }
  const raw = network
    ? road.shieldText?.trim() || road.ref?.trim()
    : road.ref?.trim() || road.shieldText?.trim();
  if (!raw) return undefined;
  const explicit = raw.match(/^([A-Z]{2})[ -]+(\d{1,4}[A-Z]?)$/);
  const local = raw.match(/^(?:SR|SH|State Route|State Highway)[ -]+(\d{1,4}[A-Z]?)$/i);
  let ref = raw;
  if (explicit && !['SR', 'SH', 'US'].includes(explicit[1] as string)) {
    const subdivision = `US-${explicit[1]}`;
    const candidates = Object.entries(library.shields).filter(
      ([, design]) => design.subdivision === subdivision,
    );
    // An explicit state reference can select a design without geographic inference.
    if (
      candidates.length !== 1 ||
      (network && library.shields[network]?.subdivision !== subdivision)
    )
      return undefined;
    // Tennessee distinguishes primary/secondary routes: a state prefix alone cannot select one.
    if (!network && candidates[0]?.[0] !== `US:${explicit[1]}`) return undefined;
    network ??= candidates[0]?.[0];
    ref = explicit[2] as string;
    evidence.push(`ref-state=${subdivision}`);
  } else if (local) {
    if (!network) {
      network = profile.stateNetwork;
      if (network && !/^US:[A-Z]{2}$/.test(network)) return undefined;
      if (network) evidence.push(`subdivision=${profile.subdivisions?.[0] ?? profile.id}`);
    }
    ref = local[1]?.toUpperCase() ?? '';
  }
  if (!network || !Object.hasOwn(library.shields, network) || !/^\d{1,4}[A-Z]?$/.test(ref))
    return undefined;
  if (!road.network && road.shieldText && road.shieldText.trim() !== ref) return undefined;
  evidence.push(road.shieldText?.trim() ? 'shield_text' : 'ref');
  return { marker: { network, ref }, evidence };
}
