/** Airside pavement and paint, batched and draped on the same grid as ordinary surfaces. */
import { buildTextMesh } from '@bendyline/molen-materials/text';
import * as THREE from 'three';
import { sampleTerrainLine } from './line-path';
import {
  appendTerrainLineBand,
  appendTerrainSurfaceArea,
  TERRAIN_PAVEMENT,
  TERRAIN_SURFACE_KIND,
  type TerrainLinePath,
  TerrainSurfaceMeshBuilder,
  terrainLinePath,
} from './linear-features';
import type { TerrainPyramidTileLayerContext } from './pyramid-stream';
import type { TerrainSemanticTile } from './semantic-types';
import { resolveTerrainSurfaceStyle, type TerrainSurfaceOptions } from './surface-styles';
import { isAeroway } from './transport-features';

/** No road wheel tracks, gutters, curbs, street lamps or car bays on airport pavement. */
export function appendAirportSurfaces(
  group: THREE.Group,
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
  options: TerrainSurfaceOptions,
  material?: THREE.Material,
): void {
  const pavement = new TerrainSurfaceMeshBuilder(context),
    paint = new TerrainSurfaceMeshBuilder(context);
  pavement.ensureAttribute('surfaceDetail', 4);
  paint.ensureAttribute('surfaceDetail', 4);
  const white = '#eee9d4',
    yellow = '#e8bd57';
  const markings = resolveTerrainSurfaceStyle(options.style, options.details).markings;
  for (const feature of tile.landcover) {
    if (!/^(apron|taxiway|runway)$/.test(feature.subclass ?? feature.class)) continue;
    for (const polygon of feature.polygons) {
      const start = pavement.vertexCount;
      appendTerrainSurfaceArea(
        pavement,
        polygon,
        new THREE.Color(feature.class === 'apron' ? '#aaa79e' : '#686b69'),
        0.48,
      );
      pavement.surfaceSince(start, TERRAIN_SURFACE_KIND.plain);
    }
  }
  const rect = (
    path: TerrainLinePath,
    distance: number,
    across: number,
    width: number,
    length: number,
  ): void => {
    const a = sampleTerrainLine(path, distance - length / 2, across - width / 2),
      b = sampleTerrainLine(path, distance + length / 2, across - width / 2);
    const c = sampleTerrainLine(path, distance + length / 2, across + width / 2),
      d = sampleTerrainLine(path, distance - length / 2, across + width / 2);
    const start = paint.vertexCount;
    paint.polygon(
      [
        [a.x, a.z],
        [b.x, b.z],
        [c.x, c.z],
        [d.x, d.z],
      ],
      new THREE.Color(white),
      0.565,
    );
    paint.surfaceSince(start, TERRAIN_SURFACE_KIND.paint, undefined, width);
  };
  for (const f of tile.transportation) {
    if (!isAeroway(f)) continue;
    const kind = f.subclass ?? f.tags?.aeroway ?? f.class;
    if (!['runway', 'taxiway', 'taxilane', 'parking_position'].includes(kind)) continue;
    for (const line of f.lines) {
      const path = terrainLinePath(line, context.tileSize);
      if (path.length < 1) continue;
      const runway = kind === 'runway',
        stand = kind === 'parking_position';
      const width = Math.max(2, Math.min(150, f.width ?? (runway ? 30 : 18)));
      const unpaved = /^(GRS|TURF|GRE|GRAVEL|DIRT)|grass|gravel|ground|turf|sand/i.test(
        f.surface ?? '',
      );
      const concrete = /^(CON)|concrete/i.test(f.surface ?? '');
      if (!stand)
        appendTerrainLineBand(
          pavement,
          path,
          {
            width,
            elevation: runway ? 0.55 : 0.51,
            color: unpaved ? '#8b9570' : concrete ? '#aaa79e' : '#646766',
            surface: TERRAIN_SURFACE_KIND.plain,
          },
          { spacing: 24, maxElements: 2500 },
        );
      if (!markings || unpaved) continue;
      if (!runway) {
        appendTerrainLineBand(
          paint,
          path,
          { width: 0.24, color: yellow, elevation: 0.535, surface: TERRAIN_SURFACE_KIND.paint },
          { spacing: 12, maxElements: 1500 },
        );
        continue;
      }
      for (const sign of [-1, 1])
        appendTerrainLineBand(
          paint,
          path,
          {
            width: 0.45,
            offset: sign * (width / 2 - 0.6),
            color: white,
            elevation: 0.565,
            surface: TERRAIN_SURFACE_KIND.paint,
          },
          { spacing: 24, maxElements: 2500 },
        );
      appendTerrainLineBand(
        paint,
        path,
        {
          width: Math.min(0.9, width / 40),
          color: white,
          elevation: 0.565,
          surface: TERRAIN_SURFACE_KIND.paint,
          dash: [30, 30],
          phase: 0,
        },
        { spacing: 30, maxElements: 1500 },
      );
      // Only a complete surveyed runway has end labels: clipped map fragments aren't thresholds.
      if (!String(f.id).startsWith('airport:')) continue;
      for (const end of [0, 1]) {
        const fromEnd = (d: number): number => (end ? path.length - d : d);
        const stripes = Math.min(8, Math.floor((width - 4) / 5));
        for (let i = 0; i < stripes; i++)
          rect(path, fromEnd(22), (i - (stripes - 1) / 2) * 4.5, 1.8, 30);
        if (path.length > 1200)
          for (const side of [-1, 1])
            rect(path, fromEnd(300), side * width * 0.27, width * 0.12, 40);
        const label = f.ref?.split('/')[end];
        if (!label || !options.fonts) continue;
        const text = buildTextMesh(label, options.fonts, {
          font: options.fonts.roles?.highway ?? options.fonts.defaultFont,
          align: 'center',
          verticalAlign: 'center',
          size: 20,
          maxWidth: width * 0.64,
          maxHeight: 20,
          maxCharacters: 6,
        });
        const origin = sampleTerrainLine(path, fromEnd(75));
        const toward = sampleTerrainLine(path, fromEnd(76));
        const dx = toward.x - origin.x,
          dz = toward.z - origin.z;
        for (let i = 0; i < text.indices.length; i += 3) {
          const points = [0, 1, 2].map((j): [number, number] => {
            const k = (text.indices[i + j] as number) * 3;
            const x = text.positions[k] as number,
              y = text.positions[k + 1] as number;
            return [origin.x - dz * x + dx * y, origin.z + dx * x + dz * y];
          });
          const start = paint.vertexCount;
          paint.polygon(points, new THREE.Color(white), 0.565);
          // Stroke width drives the pavement shader's distance fade, just as for painted bands.
          paint.surfaceSince(start, TERRAIN_SURFACE_KIND.paint, undefined, 2);
        }
      }
    }
  }
  for (const [builder, name] of [
    [pavement, 'surfaces:airport-pavement'],
    [paint, 'surfaces:airport-markings'],
  ] as const) {
    const mesh = builder.mesh(name, material);
    if (mesh) {
      mesh.userData[TERRAIN_PAVEMENT] = true;
      group.add(mesh);
    }
  }
}
