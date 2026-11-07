import { readFile } from 'node:fs/promises';
import { Box3, DoubleSide, Ray, Raycaster, Triangle, Vector3 } from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { describe, expect, it } from 'vitest';
import { b737 } from '../scripts/aircraft/boeing-737-800.mjs';
import { q400 } from '../scripts/aircraft/dash-8-q400.mjs';
import { e175 } from '../scripts/aircraft/embraer-e175.mjs';
import { g650 } from '../scripts/aircraft/gulfstream-g650er.mjs';
import { bodySurface, pchip, pose } from '../scripts/aircraft/transport-kit.mjs';
import { GLTFLoader } from './helpers/gltf-loader.mjs';

const base = new URL('../../../content/entities/', import.meta.url);
const cases = [
  // The ATR's main panel group carries its coaming; the overhead hangs under the roof.
  // The ATR's nose is its own station-table build (atr-72.mjs), not the atr72Nose profile, so
  // only the enclosure applies here; the profile's panes no longer describe its glazing.
  ['atr-72-600', ['ATR72-main-panel', 'ATR72-overhead']],
  ['bell-412ep', ['412-instrument-panel']],
  // The transport kit builds these noses. The 737 and E175 carry their own flight decks; the
  // Dash 8 and G650 the shared deck with its padded hood, all behind the kit's coaming. Pane counts
  // follow the kit's windscreen tables (posts per side + 1, both sides).
  [
    'boeing-737-800',
    ['B738-main-panel', 'B738-glareshield-face', 'B738-cabin-fixed-coaming-padding'],
    { kit: b737 },
    8,
  ],
  [
    'dash-8-q400',
    ['cockpit-fixed-instrument-panel', 'cockpit-fixed-coaming-padding', 'cockpit-coaming'],
    { kit: q400 },
    4,
  ],
  [
    'gulfstream-g650er',
    ['cockpit-fixed-instrument-panel', 'cockpit-fixed-coaming-padding', 'cockpit-coaming'],
    { kit: g650 },
    6,
  ],
  [
    'embraer-e175',
    ['E175-main-panel', 'E175-glareshield-face', 'E175-cabin-fixed-coaming-padding'],
    { kit: e175 },
    6,
  ],
];
/** The kit's authored windscreen: one glass band per side between sill and header, split by posts. */
function kitPanes(A) {
  const ck = A.cockpit,
    curve = (rows) =>
      pchip(
        rows.map((r) => r[0]),
        rows.map((r) => r[1]),
      ),
    low = curve(ck.low),
    top = curve(ck.top),
    M = bodySurface(A),
    { pitch, Y } = pose(A),
    c = Math.cos(pitch),
    s = Math.sin(pitch);
  const world = ([x, h], u) => {
    const z = A.length / 2 - u;
    return new Vector3(x, Y + h * c - z * s, h * s + z * c);
  };
  // Pane edges along the glass band at mid-height: the band ends and each slanted post.
  const middle = (post) => (post[0] + post[1]) / 2,
    edges = [ck.uStart, ...ck.posts.map(middle), ck.uEnd];
  const panes = [];
  for (const side of [-1, 1])
    for (let i = 0; i < edges.length - 1; i++) {
      const u = (edges[i] + edges[i + 1]) / 2,
        h = (low(u) + top(u)) / 2,
        a = M.angle(u, h);
      panes.push({
        outside: world(M.point(u, a, side, 0.04), u),
        inside: world(M.point(u, a, side, -0.04), u),
      });
    }
  const brow = [top(ck.uStart + 0.02), top(ck.posts[0][1] - 0.02)];
  return { panes, brow };
}

describe.each(['source', 'runtime'])('nose/dashboard fit (%s)', (version) => {
  it.each(cases)(
    '%s encloses the dashboard behind the actual skin and glazing',
    async (slug, names, profile, paneCount) => {
      const manifest = JSON.parse(
        await readFile(new URL(`source/aircraft/${slug}/source.json`, base)),
      );
      const entry = manifest.files.models.find((m) => m.output);
      const path =
        version === 'source'
          ? `source/aircraft/${slug}/${entry.path}`
          : entry.output.replace('asset.json', 'model.glb');
      const bytes = await readFile(new URL(path, base));
      const root = (
        await new GLTFLoader().parseAsync(
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
          '',
        )
      ).scene;
      root.updateMatrixWorld(true);
      const hull = [];
      const visit = (node) => {
        if (node.name === 'cockpit') return;
        if (node.isMesh) {
          node.material.side = DoubleSide;
          hull.push(node);
        }
        for (const child of node.children) visit(child);
      };
      visit(root);
      const points = new Map();
      for (const name of names) {
        const part = root.getObjectByName(name);
        expect(part, name).toBeDefined();
        part.traverse((node) => {
          if (!node.isMesh) return;
          const position = node.geometry.attributes.position;
          for (let i = 0; i < position.count; i++) {
            const v = new Vector3().fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld);
            points.set(
              v
                .toArray()
                .map((q) => q.toFixed(2))
                .join(','),
              v,
            );
          }
        });
      }
      const bounds = new Box3().setFromObject(root),
        front = bounds.max.z + 1,
        top = bounds.max.y + 1;
      // Index the actual nose triangles once rather than scanning the complete
      // airframe for every instrument vertex. Include both triangle windings.
      const hullTree = new Octree(),
        back = Math.min(...[...points.values()].map((v) => v.z)) - 0.5;
      for (const mesh of hull) {
        const p = mesh.geometry.attributes.position,
          index = mesh.geometry.index;
        for (let i = 0; i < (index?.count ?? p.count); i += 3) {
          const vertices = [0, 1, 2].map((j) =>
            new Vector3()
              .fromBufferAttribute(p, index ? index.getX(i + j) : i + j)
              .applyMatrix4(mesh.matrixWorld),
          );
          if (Math.max(...vertices.map((v) => v.z)) < back) continue;
          hullTree.addTriangle(new Triangle(...vertices));
          hullTree.addTriangle(new Triangle(vertices[2], vertices[1], vertices[0]));
        }
      }
      hullTree.build();
      const protrusions = [];
      // A ray down the shared edge of two separately imported meshes (skin and glazing) can slip
      // between them to a surface beyond, so take the nearest hit of three rays 2 mm apart. A
      // vertex that pokes through the skin is still outside all three.
      const cast = (origin, direction) => {
        let nearest;
        for (const dx of [1e-6, 0.002, -0.002]) {
          const hit = hullTree.rayIntersect(
            new Ray(origin.clone().add(new Vector3(dx, 0, 0)), direction),
          );
          if (hit && (!nearest || hit.distance < nearest.distance)) nearest = hit;
        }
        return nearest;
      };
      for (const v of points.values()) {
        // Avoid a ray exactly on the source mesh's sin(2π) centre seam.
        const hit = cast(new Vector3(v.x, v.y + 1e-6, front), new Vector3(0, 0, -1));
        // Covers the outside-facing backs and shoulders as well as the panel face.
        // A lower-view ray from the pilot cannot detect these protrusions.
        if (!hit || v.z > hit.position.z + 0.012) protrusions.push(v.toArray());
        const roof = cast(new Vector3(v.x, top, v.z + 1e-6), new Vector3(0, -1, 0));
        if (!roof || v.y > roof.position.y + 0.012) protrusions.push(v.toArray());
      }
      expect(protrusions, 'dashboard vertices outside the nose envelope').toEqual([]);
      if (profile?.kit) {
        const { panes, brow } = kitPanes(profile.kit);
        expect(panes.length).toBe(paneCount);
        expect(
          Math.abs(brow[0] - brow[1]),
          'front panes have a level brow, not a pointed arch',
        ).toBeLessThan(0.09);
        const glass = hull.filter((n) => n.material.transparent);
        for (const { outside, inside } of panes) {
          const direction = inside.clone().sub(outside);
          const hit = new Raycaster(
            outside,
            direction.clone().normalize(),
            0,
            direction.length(),
          ).intersectObjects(glass, false);
          expect(
            hit.length,
            'each pane is filled by glazing at its authored position',
          ).toBeGreaterThan(0);
        }
      }
      root.traverse((n) => {
        if (n.isMesh) n.geometry.dispose();
      });
    },
    30000,
  );
});
