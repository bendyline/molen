import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(repo, 'packages/tooling/package.json'));
export const THREE = await import(require.resolve('three'));
export const gltf = await import(require.resolve('@gltf-transform/core'));
export const { PNG } = require('pngjs');
export const sharp = require('sharp');
export const materialsApi = await import(require.resolve('@bendyline/molen-materials'));
export const tooling = await import(resolve(repo, 'packages/tooling/dist/index.mjs'));
export const sha = (data) => createHash('sha256').update(data).digest('hex');

const ID = /^[a-z][a-z0-9_-]{0,63}$/;
const finite = (n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1000;
const vec = (v, n = 3) => Array.isArray(v) && v.length === n && v.every(finite);
export function validateRecipe(r) {
  assert(r?.format === 'molen/structure-recipe@1', 'format must be molen/structure-recipe@1');
  assert(ID.test(r.id), 'id: lowercase letters, digits, hyphen or underscore');
  assert(typeof r.title === 'string' && r.title.length > 0, 'title required');
  assert(
    Array.isArray(r.materials) && r.materials.length > 0 && r.materials.length <= 8,
    '1–8 materials required',
  );
  const ids = new Set();
  for (const m of r.materials) {
    assert(ID.test(m.id) && !ids.has(m.id), 'unique material id required');
    ids.add(m.id);
    assert(/^#[0-9a-f]{6}$/i.test(m.color), `material ${m.id}: hex color required`);
    assert(!m.graph || ID.test(m.graph), 'graph must be a canonical material name');
    assert(
      m.roughness === undefined || (finite(m.roughness) && m.roughness >= 0 && m.roughness <= 1),
      'roughness 0..1',
    );
    assert(
      m.metalness === undefined || (finite(m.metalness) && m.metalness >= 0 && m.metalness <= 1),
      'metalness 0..1',
    );
    assert(
      !m.repeatMeters || (vec(m.repeatMeters, 2) && m.repeatMeters.every((v) => v > 0)),
      'repeatMeters: two positive meters',
    );
  }
  assert(
    Array.isArray(r.parts) && r.parts.length > 0 && r.parts.length <= 150,
    '1–150 parts required',
  );
  let instances = 0;
  const names = new Set();
  for (const p of r.parts) {
    assert(ID.test(p.name) && !names.has(p.name), 'unique part name required');
    names.add(p.name);
    assert(ids.has(p.material), `${p.name}: unknown material`);
    assert(
      ['box', 'beam', 'lathe'].includes(p.shape),
      `${p.name}: shape must be box, beam or lathe`,
    );
    assert(p.position === undefined || vec(p.position), `${p.name}: position must be [x,y,z]`);
    assert(
      p.rotation === undefined || vec(p.rotation),
      `${p.name}: rotation must be radians [x,y,z]`,
    );
    if (p.shape === 'box')
      assert(vec(p.size) && p.size.every((v) => v > 0), `${p.name}: positive size required`);
    if (p.shape === 'beam') {
      assert(
        vec(p.from) && vec(p.to) && finite(p.radius) && p.radius > 0,
        `${p.name}: from, to, radius required`,
      );
      assert(
        Math.hypot(...p.from.map((v, i) => v - p.to[i])) > 0.001,
        'beam endpoints must differ',
      );
    }
    if (p.shape === 'lathe') {
      assert(
        Array.isArray(p.profile) && p.profile.length >= 2 && p.profile.length <= 32,
        'lathe profile: 2–32 [radius,y] pairs',
      );
      assert(
        p.profile.every(
          (v, i) =>
            vec(v, 2) &&
            v[0] >= 0 &&
            (i === 0 ||
              (v[1] >= p.profile[i - 1][1] &&
                (v[0] !== p.profile[i - 1][0] || v[1] !== p.profile[i - 1][1]))),
        ),
        'lathe profile must not descend in y; use nonnegative radii and distinct consecutive points',
      );
    }
    assert(
      p.segments === undefined ||
        (Number.isInteger(p.segments) && p.segments >= 6 && p.segments <= 32),
      'segments 6–32',
    );
    const count = p.repeat?.count ?? 1;
    assert(Number.isInteger(count) && count > 0 && count <= 80, 'repeat count 1–80');
    assert(!p.repeat || vec(p.repeat.step), 'repeat.step [x,y,z] required');
    instances += count;
  }
  assert(instances <= 600, 'maximum 600 expanded parts');
  return r;
}

export function geometries(recipe) {
  validateRecipe(recipe);
  const out = [];
  for (const p of recipe.parts) {
    for (let i = 0; i < (p.repeat?.count ?? 1); i++) {
      let g;
      if (p.shape === 'box') g = new THREE.BoxGeometry(...p.size);
      if (p.shape === 'lathe')
        g = new THREE.LatheGeometry(
          p.profile.map((v) => new THREE.Vector2(...v)),
          p.segments ?? 16,
        );
      if (p.shape === 'beam') {
        const start = new THREE.Vector3(...p.from),
          end = new THREE.Vector3(...p.to);
        const direction = end.clone().sub(start);
        g = new THREE.CylinderGeometry(p.radius, p.radius, direction.length(), p.segments ?? 8);
        g.applyQuaternion(
          new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.normalize(),
          ),
        );
        g.translate(...start.add(end).multiplyScalar(0.5).toArray());
      }
      if (p.rotation)
        g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...p.rotation)));
      g.translate(...(p.position ?? [0, 0, 0]).map((v, k) => v + i * (p.repeat?.step[k] ?? 0)));
      // Meter-space planar UVs: avoid stretching brick courses over an entire facade.
      const mat = recipe.materials.find((m) => m.id === p.material);
      const repeat = mat.repeatMeters ?? [2, 2];
      const pos = g.getAttribute('position'),
        normal = g.getAttribute('normal'),
        uv = g.getAttribute('uv');
      for (let j = 0; j < pos.count; j++) {
        const n = [Math.abs(normal.getX(j)), Math.abs(normal.getY(j)), Math.abs(normal.getZ(j))];
        if (n[1] >= n[0] && n[1] >= n[2])
          uv.setXY(j, pos.getX(j) / repeat[0], pos.getZ(j) / repeat[1]);
        else
          uv.setXY(
            j,
            (n[0] > n[2] ? pos.getZ(j) : pos.getX(j)) / repeat[0],
            pos.getY(j) / repeat[1],
          );
      }
      // Revolution poles contain zero-area triangles in three's stock buffers.
      // Remove them before budgeting/export; do not ask a model to manage indices.
      const indices = [],
        a = new THREE.Vector3(),
        b = new THREE.Vector3(),
        c = new THREE.Vector3();
      for (let k = 0; k < g.index.count; k += 3) {
        const ia = g.index.getX(k),
          ib = g.index.getX(k + 1),
          ic = g.index.getX(k + 2);
        a.fromBufferAttribute(pos, ia);
        b.fromBufferAttribute(pos, ib);
        c.fromBufferAttribute(pos, ic);
        if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-12) indices.push(ia, ib, ic);
      }
      g.setIndex(indices);
      out.push({ name: `${p.name}-${i}`, material: p.material, geometry: g });
    }
  }
  const bounds = new THREE.Box3();
  let triangles = 0;
  for (const { geometry: g } of out) {
    g.computeBoundingBox();
    bounds.union(g.boundingBox);
    triangles += (g.index?.count ?? g.attributes.position.count) / 3;
  }
  assert(triangles > 0, 'Model must contain nondegenerate triangles');
  assert(triangles <= 8000, `triangle budget exceeded: ${triangles} > 8000`);
  assert(Math.abs(bounds.min.y) < 0.05, `base must be at Y=0 (got ${bounds.min.y})`);
  return {
    parts: out,
    triangles,
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
  };
}

export async function encodeRecipe(recipe, textures, { untextured = false } = {}) {
  const { parts, triangles, bounds } = geometries(recipe);
  const doc = new gltf.Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene(recipe.title);
  const mats = new Map();
  for (const m of recipe.materials) {
    const color = new THREE.Color(m.color);
    const material = doc
      .createMaterial(m.id)
      .setBaseColorFactor([...color.toArray(), 1])
      .setRoughnessFactor(m.roughness ?? 0.85)
      .setMetallicFactor(m.metalness ?? 0);
    if (!untextured && textures.has(m.id)) {
      const tex = textures.get(m.id);
      for (const [slot, bytes] of Object.entries(tex)) {
        const t = doc.createTexture(`${m.id}-${slot}`).setMimeType('image/png').setImage(bytes);
        if (slot === 'basecolor') material.setBaseColorTexture(t);
        if (slot === 'orm')
          material.setMetallicRoughnessTexture(t).setMetallicFactor(1).setRoughnessFactor(1);
      }
    }
    mats.set(m.id, material);
  }
  for (const { name, material, geometry: g } of parts) {
    const prim = doc.createPrimitive().setMaterial(mats.get(material));
    for (const [name, semantic, type] of [
      ['position', 'POSITION', 'VEC3'],
      ['normal', 'NORMAL', 'VEC3'],
      ['uv', 'TEXCOORD_0', 'VEC2'],
    ]) {
      prim.setAttribute(
        semantic,
        doc
          .createAccessor()
          .setType(type)
          .setArray(new Float32Array(g.getAttribute(name).array))
          .setBuffer(buffer),
      );
    }
    prim.setIndices(
      doc
        .createAccessor()
        .setType('SCALAR')
        .setArray(new Uint32Array(g.index.array))
        .setBuffer(buffer),
    );
    scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
    g.dispose();
  }
  return { bytes: await new gltf.NodeIO().writeBinary(doc), triangles, bounds };
}
