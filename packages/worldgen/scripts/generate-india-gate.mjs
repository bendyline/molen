/** Bounded aerial landmark: 42 m sandstone arch, open passage, stepped cornice and bowl.
 * Overall height: Delhi Tourism; other dimensions estimated from credited reference imagery. */
import './install-deterministic-math.mjs';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const base = new URL('../../../content/worldgen/source/places/tt/ttn/india_gate/', import.meta.url);
await mkdir(new URL('models/', base), { recursive: true });
const out = new MeshBufferBuilder(),
  stone = rgb('c8b18b'),
  trim = rgb('d2bb96'),
  red = rgb('ab846c');
const B = (lo, hi, color = stone) => box(out, 'wall', lo, hi, color);
// Grounded red plinth, two piers and real opening. Width/depth are photographic estimates.
B([-14.5, 0, -7.5], [14.5, 0.65, 7.5], red);
for (const side of [-1, 1]) {
  const a = side < 0 ? [-13.5, -4.55] : [4.55, 13.5];
  B([a[0], 0.65, -6.2], [a[1], 22, 6.2]);
  B([a[0] - 0.35, 1, -6.55], [a[1] + 0.35, 2.6, 6.55], red);
  B([a[0] - 0.25, 20.8, -6.45], [a[1] + 0.25, 22, 6.45], trim);
}
// Faceted semicircular intrados with filled spandrels, 12 segments through 12.4 m depth.
for (let i = 0; i < 12; i++) {
  const a = (Math.PI * i) / 12,
    b = (Math.PI * (i + 1)) / 12;
  const x0 = 4.55 * Math.cos(a),
    x1 = 4.55 * Math.cos(b),
    y0 = 22 + 4.55 * Math.sin(a),
    y1 = 22 + 4.55 * Math.sin(b);
  for (const side of [-1, 1]) {
    const p = [
      [x0, y0, 6.2 * side],
      [x1, y1, 6.2 * side],
      [x1, 28, 6.2 * side],
      [x0, 28, 6.2 * side],
    ];
    quad(out, 'wall', side > 0 ? p : p.reverse(), [0, 0, side], stone);
  }
  quad(
    out,
    'wall',
    [
      [x0, y0, -6.2],
      [x1, y1, -6.2],
      [x1, y1, 6.2],
      [x0, y0, 6.2],
    ],
    [-Math.cos((a + b) / 2), -Math.sin((a + b) / 2), 0],
    stone,
  );
}
B([-13.5, 22, -6.2], [-4.55, 28, 6.2]);
B([4.55, 22, -6.2], [13.5, 28, 6.2]);
B([-13.5, 28, -6.2], [13.5, 34, 6.2]);
B([-14.1, 33.6, -6.8], [14.1, 35, 6.8], trim);
B([-12.1, 35, -5.8], [12.1, 40, 5.8]);
B([-12.7, 39.5, -6.3], [12.7, 40.6, 6.3], trim);
B([-9.7, 40.6, -4.9], [9.7, 41.2, 4.9]);
// Shallow commemorative bowl as a low polygonal cap, not a spire.
tube(out, 'wall', [0, 41.2, 0], [0, 42, 0], 2.5, trim, 12);
const mesh = out.finalize();
validateAuthoredMesh(mesh, 'india_gate');
const bytes = Buffer.from(
  encodeGlb(
    mesh,
    mesh.groups.map(() => ({ name: 'sandstone', roughness: 0.92, metallic: 0 })),
    'India Gate aerial silhouette',
  ),
);
await writeFile(new URL('models/source.glb', base), bytes);
const hash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
await writeFile(
  new URL('source.json', base),
  JSON.stringify(
    {
      format: 'molen/source-bundle@1',
      id: 'molen.worldgen.structure.india_gate',
      kind: 'static-structure',
      title: 'India Gate',
      files: {
        definitions: [],
        models: [
          {
            path: 'models/source.glb',
            assetId: 'molen.worldgen.structure.india_gate',
            output: 'assets/places/tt/ttn/india_gate/asset.json',
            pipeline: 'import',
            sha256: hash,
          },
        ],
        scripts: [],
        textures: [],
        sounds: [],
        documents: ['README.md', 'spec.json', 'review.md'],
      },
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify({ hash, triangles: mesh.indices.length / 3, bytes: bytes.length }));
