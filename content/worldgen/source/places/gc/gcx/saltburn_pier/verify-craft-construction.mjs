/** Imported rail/post/haunch/roof checks, full fixed exterior openings and frozen surroundings. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  saltburnPier,
  saltburnPierDistrict,
  saltburnPierSkyline,
  saltburnPierStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-saltburn-pier.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/gc/gcx/saltburn_pier/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  c = read('craft-construction-controls.json'),
  base = read('retained-craft-surroundings-v3.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  results = [],
  slots = [
    'strut',
    'haunch',
    'kickboard',
    'roundRail',
    'castPost',
    'slateCourse',
    'entranceGlass',
    'doorJoinery',
  ];
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
for (const [d, build] of [
  saltburnPierSkyline,
  saltburnPierDistrict,
  saltburnPierStreet,
  saltburnPier,
].entries()) {
  const builder = new MeshBufferBuilder();
  build(builder);
  const s = builder.finalize();
  validateAuthoredMesh(s, `Saltburn source${d}`);
  const h = createHash('sha256'),
    added = {};
  let retained = 0;
  for (const g of s.groups) {
    if (slots.includes(g.slot)) {
      added[g.slot] = g.count / 3;
      const edges = new Map(),
        key = (p) => p.map((v) => Math.round(v * 1e6)).join(',');
      for (let k = g.start; k < g.start + g.count; k += 3) {
        const ids = Array.from(s.indices.slice(k, k + 3)),
          p = ids.map((i) => Array.from(s.positions.slice(i * 3, i * 3 + 3))),
          uv = ids.map((i) => Array.from(s.uvs.slice(i * 2, i * 2 + 2)));
        assert(
          Math.abs(
            (uv[1][0] - uv[0][0]) * (uv[2][1] - uv[0][1]) -
              (uv[2][0] - uv[0][0]) * (uv[1][1] - uv[0][1]),
          ) > 1e-10,
          'zero UV',
        );
        for (let j = 0; j < 3; j++) {
          const e = [key(p[j]), key(p[(j + 1) % 3])].sort().join('|');
          edges.set(e, (edges.get(e) ?? 0) + 1);
        }
      }
      if (g.slot !== 'slateCourse' && (g.slot !== 'strut' || d === 3))
        for (const [e, n] of edges) assert(n >= 2 && n % 2 === 0, `${g.slot}:unpaired${e}/${n}`);
      continue;
    }
    retained += g.count / 3;
    for (let k = g.start; k < g.start + g.count; k++)
      for (const [key, n] of [
        ['positions', 3],
        ['normals', 3],
        ['uvs', 2],
        ['colors', 3],
      ]) {
        const v = s[key].slice(s.indices[k] * n, s.indices[k] * n + n);
        h.update(Buffer.from(v.buffer, v.byteOffset, v.byteLength));
      }
  }
  assert.equal(`sha256:${h.digest('hex')}`, base.levels[d].retainedAttributeHash);
  assert.equal(retained, base.levels[d].retainedTriangles);
  assert.deepEqual(
    added,
    d === 3
      ? {
          strut: 1440,
          haunch: 1120,
          kickboard: 372,
          roundRail: 3472,
          castPost: 15768,
          entranceGlass: 192,
          doorJoinery: 240,
          slateCourse: 9600,
        }
      : d === 2
        ? { strut: 240, haunch: 1120, entranceGlass: 12, slateCourse: 72 }
        : d === 1
          ? { strut: 240, entranceGlass: 12 }
          : { entranceGlass: 12 },
  );
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  let triangles = 0;
  gltf.scene.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      indices = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices, vertexCount: p.count },
      `Saltburn import${d}`,
    );
    triangles += indices.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
  });
  assert.equal(triangles, s.triangleCount);
  assert.equal(triangles, level.triangles);
  assert(triangles <= [1000, 4000, 16000, 64000][d]);
  assert(level.drawCalls <= [1, 8, 8, 8][d]);
  let controls = 1,
    openingChecks = 0,
    posts = 0,
    postContacts = 0,
    pipes = 0,
    kickboards = 0,
    haunches = 0,
    roofFaces = 0,
    doorGlazing = 0,
    attachedStruts = 0;
  const hits = (a, b) => {
      const start = new T.Vector3(...a),
        delta = new T.Vector3(...b).sub(start);
      return new T.Raycaster(
        start,
        delta.clone().normalize(),
        1e-6,
        delta.length() - 1e-6,
      ).intersectObject(gltf.scene);
    },
    match = (a, b, p, label) => {
      assert(
        hits(a, b).some((h) => h.point.distanceTo(new T.Vector3(...p)) < 0.0004),
        label,
      );
      controls++;
    };
  for (const p of c.originalOpeningControls.filter((p) => p.level === d)) {
    if (c.doorPose.replacesOriginalOpeningControls.includes(p.name)) {
      assert(
        hits(p.a, p.b).length > 0,
        'reference closed exterior glazing replaces the original empty opening',
      );
      controls++;
      continue;
    }
    assert.equal(hits(p.a, p.b).length, 0, p.name);
    controls++;
    openingChecks++;
  }
  const ca = Math.cos(c.arcadeAngle),
    sa = Math.sin(c.arcadeAngle),
    doorPoint = (u, y, v, z) => {
      const x = c.doorPose.planeX - v,
        zz = z + u;
      return [ca * x + sa * zz, y, -sa * x + ca * zz];
    };
  for (const [z, w] of d === 3 ? c.doorPose.porches : [[0, 4.2]]) {
    const divisions = d === 3 ? (w > 3 ? 4 : 2) : 1,
      step = w / divisions;
    for (let i = 0; i < divisions; i++)
      for (const y of [0.75, 1.8])
        for (const sign of [-1, 1]) {
          const u = -w / 2 + (i + 0.5) * step,
            target = c.doorPose.planeZ + (sign * c.doorPose.glassDepth) / 2;
          match(
            doorPoint(u, y, target + sign * 0.09, z),
            doorPoint(u, y, target - sign * 0.09, z),
            doorPoint(u, y, target, z),
            'reference closed recessed glass front/back',
          );
          doorGlazing++;
        }
    if (d === 3)
      for (let i = 1; i < divisions; i++) {
        const u = -w / 2 + i * step;
        match(
          doorPoint(u, 1.8, 0.02, z),
          doorPoint(u, 1.8, -0.2, z),
          doorPoint(u, 1.8, c.doorPose.frameZ + c.doorPose.frameDepth / 2, z),
          'physical red joinery front',
        );
      }
    match(
      doorPoint(0.25, 0.33, -0.35, z),
      doorPoint(0.25, 0.26, -0.35, z),
      doorPoint(0.25, 0.3, -0.35, z),
      'shopfront threshold original platform contact',
    );
  }
  if (d >= 1)
    for (const x of c.trestleRows)
      for (const z of c.attachedStruts.planes)
        for (const sign of [-1, 1]) {
          const t = c.attachedStruts,
            endX = x + sign * t.halfReachX;
          assert(t.beamEndY > t.beamBottomY && t.beamEndY < t.beamTopY);
          match(
            [endX, -0.22, z],
            [endX, 0.02, z],
            [endX, t.beamBottomY, z],
            'short strut attaches inside original longitudinal timber',
          );
          const pileCenter = z + ((z * 1.35 - z) * (t.pileStartY + 0.45)) / (-8 + 0.45);
          assert(Math.abs(z - pileCenter) + t.width / 2 < 0.13, 'strut foot embeds original pipe');
          const mid = [x + sign * t.halfReachX * 0.5, (t.pileStartY + t.beamEndY) / 2, z];
          assert(
            [
              ...hits([mid[0], mid[1], z + 0.12], [mid[0], mid[1], z - 0.12]),
              ...hits([mid[0], mid[1], z - 0.12], [mid[0], mid[1], z + 0.12]),
            ].length > 0,
            'new attached strut surface',
          );
          controls++;
          attachedStruts++;
        }
  if (d >= 2) {
    for (const x of c.trestleRows)
      for (const sign of [-1, 1]) {
        for (const k of [2, 3, 4, 5]) {
          const a = c.haunchProfile[k],
            b = c.haunchProfile[k + 1],
            z = (sign * (a[0] + b[0])) / 2,
            y = (a[1] + b[1]) / 2 + 0.01;
          for (const side of [-1, 1])
            match(
              [x + side * 0.3, y, z],
              [x - side * 0.3, y, z],
              [x + (side * c.haunchWidth) / 2, y, z],
              'physical shaped haunch sides',
            );
        }
        match(
          [x + 0.3, -0.3, sign * 1.8],
          [x - 0.3, -0.3, sign * 1.8],
          [x + 0.175, -0.3, sign * 1.8],
          'haunch embeds original transverse timber beam',
        );
        haunches++;
      }
    const co = Math.cos(c.arcadeAngle),
      si = Math.sin(c.arcadeAngle),
      point = (p) => [co * p[0] + si * p[2], p[1], -si * p[0] + co * p[2]];
    for (const [z, w, ridge] of [
      [-8.1, 6.8, 6.45],
      [0, 9.4, 7.5],
      [8.1, 6.8, 6.45],
    ])
      for (const sign of [-1, 1]) {
        const t = 0.43,
          p = [1.17, 0.3 + 3.8 + (ridge - 3.8) * t, z + sign * (w / 2 + 0.2) * (1 - t)];
        match(
          point([p[0], p[1] + 0.1, p[2]]),
          point([p[0], p[1] - 0.1, p[2]]),
          point(p),
          'six actual slate roof planes',
        );
        roofFaces++;
      }
  }
  if (d === 3)
    for (const seg of c.segments) {
      const dx = (seg.b[0] - seg.a[0]) / seg.length,
        dz = (seg.b[1] - seg.a[1]) / seg.length,
        pitch = seg.length / seg.posts,
        point = (x, y, z) => [
          (seg.a[0] + seg.b[0]) / 2 + dx * x - dz * z,
          y,
          (seg.a[1] + seg.b[1]) / 2 + dz * x + dx * z,
        ],
        mid = -seg.length / 2 + 0.37 * pitch;
      for (const [y, z] of c.pipeLevels) {
        for (const a of [0, Math.PI / 8, Math.PI / 2]) {
          const radius = a === Math.PI / 8 ? c.pipeRadius * Math.cos(Math.PI / 8) : c.pipeRadius;
          match(
            point(mid, y + Math.sin(a) * 0.08, z + Math.cos(a) * 0.08),
            point(mid, y, z),
            point(mid, y + Math.sin(a) * radius, z + Math.cos(a) * radius),
            'genuine round octagonal rail surface',
          );
        }
        pipes++;
      }
      for (const sign of [-1, 1])
        match(
          point(mid, c.deckY + 0.08, sign * 0.08),
          point(mid, c.deckY + 0.08, -sign * 0.08),
          point(mid, c.deckY + 0.08, (sign * c.kickboardDepth) / 2),
          'solid kickboard front/back',
        );
      kickboards++;
      for (let i = seg.keepStart ? 0 : 1; i <= seg.posts; i++) {
        const x = -seg.length / 2 + i * pitch;
        for (const [z, y] of c.postCenters.slice(1, -1))
          for (const sign of [-1, 1])
            match(
              point(x + sign * 0.08, y, z),
              point(x - sign * 0.08, y, z),
              point(x + (sign * c.postWidth) / 2, y, z),
              'continuous cast-post sides',
            );
        const shift = i === seg.posts ? -0.08 : 0.08;
        assert(
          [-1, 1].some((sign) =>
            hits(point(x + shift, 0.33, sign * 0.13), point(x + shift, 0.26, sign * 0.13)).some(
              (h) => Math.abs(h.point.y - c.deckY) < 0.0004,
            ),
          ),
          'post contact with retained deck',
        );
        assert(c.postCenters[0][1] < c.deckY);
        controls++;
        posts++;
        postContacts++;
      }
    }
  results.push({
    level: base.levels[d].level,
    triangles,
    drawCalls: level.drawCalls,
    retainedTriangles: retained,
    added,
    controls,
    originalOpeningChecks: openingChecks,
    continuousCastPosts: posts,
    retainedDeckContacts: postContacts,
    roundPipes: pipes,
    solidKickboards: kickboards,
    shapedTimberHaunches: haunches,
    slateRoofPlanes: roofFaces,
    closedGlazingSurfaceChecks: doorGlazing,
    attachedShortStruts: attachedStruts,
    failed: 0,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'saltburn_pier',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
