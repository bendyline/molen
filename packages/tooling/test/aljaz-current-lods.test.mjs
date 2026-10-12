import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u2/u21/n0602_aljaz_tower'),
  runtime = source.replace('/source/', '/assets/').replace('\\source\\', '\\assets\\');
const read = async (p) => JSON.parse(await readFile(p)),
  hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
function geometry(b) {
  const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))),
    bin = 28 + b.readUInt32LE(12);
  const array = (i) => {
    const a = g.accessors[i],
      v = g.bufferViews[a.bufferView],
      n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type],
      w = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType],
      p = bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return Array.from({ length: a.count }, (_, i) =>
      Array.from({ length: n }, (_, c) => {
        const at = p + i * (v.byteStride ?? w * n) + c * w;
        return a.componentType === 5126
          ? b.readFloatLE(at)
          : a.componentType === 5125
            ? b.readUInt32LE(at)
            : a.componentType === 5123
              ? b.readUInt16LE(at)
              : b.readUInt8(at);
      }),
    );
  };
  return g.meshes.flatMap((m) =>
    m.primitives.flatMap((p) => {
      const ps = array(p.attributes.POSITION),
        ids = array(p.indices).flat();
      return Array.from({ length: ids.length / 3 }, (_, i) =>
        ids.slice(i * 3, i * 3 + 3).map((id) => ps[id]),
      );
    }),
  );
}
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
function hit(o, d, p) {
  const a = sub(p[1], p[0]),
    b = sub(p[2], p[0]),
    h = cross(d, b),
    det = dot(a, h);
  if (Math.abs(det) < 1e-8) return null;
  const q = sub(o, p[0]),
    u = dot(q, h) / det,
    v = dot(d, cross(q, a)) / det;
  return u < -0.00001 || v < -0.00001 || u + v > 1.00001 ? null : dot(b, cross(q, a)) / det;
}


it('retains all eight real viewing recesses in district, street and closeup', async () => {
  for(const name of ['district','street','closeup']) {
    const ts=geometry(await readFile(runtime+'/model.'+name+'.glb'));
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4,y=i%2?1.01:1.595,
        // Start inside the guy wires so they cannot obscure the rear viewing pane.
        o=[0.675*Math.sin(a),y,0.675*Math.cos(a)],d=[-Math.sin(a),0,-Math.cos(a)],
        ds=ts.map(p=>hit(o,d,p)).filter(t=>t!==null&&t>0&&t<2);
      expect(Math.min(...ds),name+' viewing window '+i).toBeGreaterThan(0.06);
      expect(Math.min(...ds)).toBeLessThan(0.09);
    }
  }
});
it('preserves the original source master and keeps unresolved doorway bearing inactive', async()=>{
  expect(hash(await readFile(source+'/models/source.glb'))).toBe('sha256:2b9cf37d0cbfe226d43fd2f80e9e0560ed36e6209147c3bbd4dc807766502c39');
  const s=await read(source+'/spec.json'),p=(await read('../../content/earth/structures/placements.json')).entries.find(p=>p.asset===s.assetId);
  expect(s.sourceFacts.viewingWindowCount).toBe(8);
  expect(s.geographicProposal.anchor).toEqual([13.836673765,46.37830418]);
  expect(s.geographicProposal.status).toBe('orientation-review');
  expect(p?.status).not.toBe('preview');
  expect(s.geographicProposal.heading).toBeUndefined();
});
it('rebuilds four byte-identical budgeted levels with one shared graph and no embedded images', async()=>{
  const a=await read(runtime+'/asset.json'),before=await Promise.all(a.runtimeLods.levels.map(l=>readFile(runtime+'/'+l.file)));
  await buildModelLandmarkLods(runtime+'/asset.json',{force:true});
  expect((await read(runtime+'/asset.json')).runtimeLods).toEqual(a.runtimeLods);
  expect(a.runtimeLods.levels.slice(0,2).reduce((n,l)=>n+l.bytes,0)).toBeLessThan(3000000);
  const refs=new Set();
  for(const [i,l]of a.runtimeLods.levels.entries()) {
    const b=await readFile(runtime+'/'+l.file),g=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
    expect(b.equals(before[i])).toBe(true);
    expect(l.triangles).toBeLessThanOrEqual([1000,4000,16000,64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    expect(g.images??[]).toHaveLength(0);
    for(const m of g.materials)if(m.extras?.molenSurface?.ref)refs.add(m.extras.molenSurface.ref);
  }
  expect([...refs]).toEqual(['matgraph:molen.worldgen.material.metal_painted']);
});
