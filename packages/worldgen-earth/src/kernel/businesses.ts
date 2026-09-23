/** Conservative POI-to-footprint association and local frontage estimates. */
import {
  pointInPolygon,
  polygonArea,
  polygonBounds,
  type TerrainPoiFeature,
  type TerrainSemanticPoint,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import {
  type BuildingRequest,
  type ResolvedStylePack,
  ringCentroid,
  type StorefrontRequest,
  type Vec2,
} from '@bendyline/molen-worldgen/kernel';
import type { BuildingPiece } from './building-parts';
import { type ResolvedBusiness, resolveBusiness } from './business-catalog';

interface Occupant {
  poi: TerrainPoiFeature;
  business: ResolvedBusiness;
  direct: boolean;
}
export type BuildingOccupants = Map<BuildingPiece, Occupant[]>;
function identity(poi: TerrainPoiFeature): string {
  return poi.id !== undefined
    ? `poi:${poi.id}`
    : `poi:${JSON.stringify([poi.name ?? '', poi.class, poi.point])}`;
}
function boundsContain(p: TerrainSemanticPoint, b: readonly number[]): boolean {
  return p[0] >= (b[0] ?? 0) && p[0] <= (b[2] ?? 0) && p[1] >= (b[1] ?? 0) && p[1] <= (b[3] ?? 0);
}
export function associateBusinesses(
  tile: TerrainSemanticTile,
  pieces: readonly BuildingPiece[],
): BuildingOccupants {
  const output: BuildingOccupants = new Map();
  const candidates = pieces
    .filter((p) => (p.feature.minHeight ?? 0) < 2)
    .map((piece) => ({
      piece,
      bounds: polygonBounds(piece.polygon),
      area: polygonArea(piece.polygon),
    }));
  const seen = new Set<string>();
  for (const poi of tile.pois ?? []) {
    const key = identity(poi);
    if (seen.has(key)) continue;
    seen.add(key);
    const business = resolveBusiness(poi);
    if (!business) continue;
    const contained = candidates.filter(
      (c) => boundsContain(poi.point, c.bounds) && pointInPolygon(poi.point, c.piece.polygon),
    );
    const direct = contained.filter((c) => poi.id !== undefined && c.piece.feature.id === poi.id);
    const matches = direct.length ? direct : contained;
    // A direct source identity wins. Otherwise accept a unique containing footprint.
    matches.sort(
      (a, b) =>
        a.area - b.area || (String(a.piece.feature.id) < String(b.piece.feature.id) ? -1 : 1),
    );
    const chosen = matches[0];
    if (!chosen) continue;
    if (matches.length > 1) continue;
    const list = output.get(chosen.piece) ?? [];
    list.push({ poi, business, direct: direct.length > 0 });
    output.set(chosen.piece, list);
  }
  for (const piece of pieces) {
    if (output.has(piece)) continue;
    const business = resolveBusiness({
      class: piece.feature.subclass ?? piece.feature.class ?? 'building',
      name: piece.feature.name,
      brand: piece.feature.brand,
      brandId: piece.feature.brandId,
    });
    if (!business) continue;
    const point = ringCentroid(piece.polygon.outer);
    output.set(piece, [
      {
        poi: { ...piece.feature, class: piece.feature.class ?? 'building', point },
        business,
        direct: true,
      },
    ]);
  }
  return output;
}
function frontagePoint(
  poi: TerrainPoiFeature,
  piece: BuildingPiece,
  tile: TerrainSemanticTile,
  size: number,
): Vec2 {
  const ring = piece.polygon.outer;
  const longest = Math.max(
    ...ring.map((a, i) => {
      const b = ring[(i + 1) % ring.length] as Vec2;
      return Math.hypot(b[0] - a[0], b[1] - a[1]);
    }),
  );
  const minimum = Math.min(longest, 6 / size);
  let best: { point: Vec2; score: number } | undefined;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as Vec2,
      b = ring[(i + 1) % ring.length] as Vec2;
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    if (length < Math.max(1e-8, minimum)) continue;
    const t = Math.max(
      0.15,
      Math.min(0.85, ((poi.point[0] - a[0]) * dx + (poi.point[1] - a[1]) * dz) / (length * length)),
    );
    const point: Vec2 = [a[0] + dx * t, a[1] + dz * t];
    let access = Number.POSITIVE_INFINITY;
    for (const road of tile.transportation) {
      if (road.tunnel) continue;
      for (const line of road.lines)
        for (let j = 1; j < line.length; j++) {
          const ra = line[j - 1] as Vec2,
            rb = line[j] as Vec2,
            rx = rb[0] - ra[0],
            rz = rb[1] - ra[1];
          const rt = Math.max(
            0,
            Math.min(
              1,
              ((point[0] - ra[0]) * rx + (point[1] - ra[1]) * rz) / (rx * rx + rz * rz || 1),
            ),
          );
          access = Math.min(
            access,
            Math.hypot(point[0] - ra[0] - rt * rx, point[1] - ra[1] - rt * rz),
          );
        }
    }
    const distance = Math.hypot(point[0] - poi.point[0], point[1] - poi.point[1]);
    const score = distance + Math.min(access, 0.03) * 0.45;
    if (!best || score < best.score) best = { point, score };
  }
  return best?.point ?? poi.point;
}
export function applyBusinessAppearance(
  request: BuildingRequest,
  piece: BuildingPiece,
  occupants: readonly Occupant[],
  tile: TerrainSemanticTile,
  size: number,
  styles: ResolvedStylePack['archstyles'],
): void {
  if (!occupants.length) return;
  request.interiorLabels = [
    ...new Set(
      [...occupants]
        .sort(
          (a, b) =>
            Number(b.direct) - Number(a.direct) ||
            (identity(a.poi) < identity(b.poi) ? -1 : identity(a.poi) > identity(b.poi) ? 1 : 0),
        )
        .flatMap((o) => [o.poi.class, o.business.category]),
    ),
  ];
  const host = occupants.find((o) => o.direct && o.business.category === 'grocery');
  const signs = host
    ? occupants.filter((o) => o === host || !['cafe', 'pharmacy'].includes(o.business.category))
    : occupants;
  const kind = piece.feature.subclass ?? piece.feature.class ?? 'building';
  const storeEnvelope =
    [
      'building',
      'yes',
      'unknown',
      'commercial',
      'retail',
      'shop',
      'supermarket',
      'grocery',
      'fast_food',
      'restaurant',
      'cafe',
      'pharmacy',
      'department_store',
      'mall',
      'shopping_centre',
      'shopping_center',
      'outlet_mall',
      'strip_mall',
      'wholesale',
      'electronics',
      'doityourself',
      'furniture',
      'clothes',
      'sports',
      'pet',
      'variety_store',
      'chemist',
    ].includes(kind) &&
    (request.levels ?? 1) <= 2 &&
    (request.height ?? 6) <= 14;
  const mallEnvelope = [
    'mall',
    'shopping_centre',
    'shopping_center',
    'outlet_mall',
    'strip_mall',
  ].includes(kind);
  // A ground-floor business must not turn an apartment/office tower into a low store shell.
  if (storeEnvelope && !mallEnvelope)
    request.labels = [
      ...new Set([
        ...occupants.map((o) => (o.business.category === 'grocery' ? 'supermarket' : o.poi.class)),
        ...request.labels,
      ]),
    ];
  // Only a directly identified host can select identity-specific massing. A coffee shop
  // inside a mall must not shrink the entire mall to a restaurant. Custom packs may omit
  // these styles, in which case their selected/default architectural rules stay valid.
  const direct = occupants.filter((o) => o.direct);
  const hostStyle = direct.length === 1 ? direct[0]?.business.style : undefined;
  const preferredStyle = hostStyle ?? 'molen.worldgen.generic.store';

  if (storeEnvelope && styles[preferredStyle] && (hostStyle || !mallEnvelope))
    request.style = preferredStyle;
  const standalone = signs.length === 1 ? signs[0] : undefined;
  if (storeEnvelope && standalone?.direct && standalone.business.profile)
    request.appearance = {
      wall: standalone.business.profile.wall,
      trim: standalone.business.profile.accent,
    };
  const used = new Set<string>();
  request.storefronts = signs
    .filter((o) => {
      const [u, v] = o.poi.point;
      if (request.clipped && (u < 0 || v < 0 || u >= 1 || v >= 1)) return false;
      const key = identity(o.poi);
      if (used.has(key)) return false;
      used.add(key);
      return true;
    })
    .sort((a, b) => (identity(a.poi) < identity(b.poi) ? -1 : 1))
    .slice(0, 12)
    .map((o): StorefrontRequest => {
      const p = frontagePoint(o.poi, piece, tile, size);
      return {
        identity: identity(o.poi),
        at: [p[0] * size, p[1] * size],
        signModel: o.business.sign,
        accent: o.business.accent,
        width: standalone ? (o.business.width ?? 18) : (o.business.sharedWidth ?? 9),
      };
    });
}
