import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  fbox, opening, outwardRing, quad4, rgb, tri, wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  plaster: { slot: 'wall', graph: 'stucco', roughness: .95 },
  surround: { slot: 'trim', graph: 'stone_ashlar', roughness: .89 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: .94 },
  rampart: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: .99 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: .88 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: .61 },
};

const bluish = rgb('a5b7c6'), blue = rgb('94a9bc'), cream = rgb('d5d2c1'), pale = rgb('e0dac8');
const stucco = rgb('b8c4c5'), roof = rgb('aba697'), terra = rgb('b28e73'), window = rgb('566364');
const iron = rgb('686e6c'), stones = ['79796b','746f61','858171','81796a'].map(rgb);
const { outline, court, upper, lowerRoof, upperWallHeight, upperRoof } = site;

function cap(out, slot, polygon, y, color) {
  const [outer, ...holes] = polygon;
  const mesh = new MeshBufferBuilder();
  if (!mesh.addCap('roof', 'palette:#ffffff', outer, holes, () => y, [0, 1, 0], p => p, color))
    throw Error('The palace courtyard roof could not be triangulated.');
  const { indices, positions } = mesh.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), j => positions.slice(j * 3, j * 3 + 3));
    tri(out, slot, ...points, color);
  }
}

function wall(out, slot, f, y0, y1, d, color) {
  const p = f.P;
  quad4(out, slot, p(0,y0,d), p(f.length,y0,d), p(f.length,y1,d), p(0,y1,d), color);
}

function visitEdges(ring, each, inner = false) {
  const shell = outwardRing(ring);
  if (inner) shell.reverse();
  for (const [i, a] of shell.entries()) {
    const b = shell[(i + 1) % shell.length], f = wallFace(a,b);
    if (f.length > .025) each(f,i);
  }
}

function fort(out, detail) {
  for (const [vertices, inner] of [[outline,false], [court,true]]) {
    visitEdges(vertices, (f,i) => {
      wall(out,'rampart',f,site.foundation,.25,-.012,stones[1]);
      wall(out,'plaster',f,.25,lowerRoof,0,inner ? stucco : i % 5 === 0 ? bluish : blue);
      wall(out,'surround',f,lowerRoof-.29,lowerRoof+.025,.034,cream);
      if (detail === 0 || f.length < 3.06) return;
      const count = inner ? Math.max(1,Math.round(f.length / 3.5)) : Math.round(f.length / 5.6);
      for (let j = 0; j < count; j++) {
        const u = f.length * (j + .5) / count;
        opening(out,f,u,inner ? 3.77 : 4.52,inner ? 1.06 : .63,inner ? 2.23 : 1.38,{
          frameSlot:'surround',frame:cream,glass:window,frameWidth:detail > 1 ? .093 : 0,
          mullions:detail > 2 && inner ? 1 : 0,d:.026,
        });
      }
    }, inner);
  }
  cap(out,'tile',[outline,court],lowerRoof,roof);
  cap(out,'tile',[court],site.courtGrade,terra);
}

function turrets(out, detail) {
  for (const { indices,parapet } of site.towers) {
    const vertices = indices.map(i=>outline[i]);
    const order = outwardRing(vertices);
    const ends = new Set([vertices[0],vertices.at(-1)]);
    visitEdges(order,(f,i) => {
      const a = order[i], b = order[(i+1)%order.length];
      if (ends.has(a) && ends.has(b)) return;
      fbox(out,'plaster',f,0,f.length,lowerRoof,parapet,-.45,.02,bluish);
      if (detail === 0) return;
      if (detail === 3) fbox(out,'plaster',f,0,f.length,parapet-.10,parapet,-.05,.073,cream);
      const n = Math.max(1,Math.round(f.length/1.06));
      for (let j = 0; j < n; j++) {
        const u = f.length * (j+.5)/n, half = Math.min(.27,f.length*.3);
        fbox(out,'surround',f,u-half,u+half,parapet,parapet+.43,-.44,.07,pale);
      }
    });
  }
}

function palace(out, detail) {
  const fore = wallFace(...site.front);
  for (const rings of upper) {
    for (const [i, ring] of rings.entries()) {
      const inner = i > 0;
      visitEdges(ring, f => {
        wall(out,'plaster',f,lowerRoof,upperWallHeight,0,inner?bluish:stucco);
        wall(out,'surround',f,upperWallHeight-.37,upperWallHeight+.082,.036,cream);
        wall(out,'surround',f,13.54,13.78,.037,cream);
        wall(out,'plaster',f,upperWallHeight,upperRoof,.008,bluish);
        wall(out,'surround',f,upperRoof-.13,upperRoof+.028,.034,cream);
        const waterfront = f.normal[0]*fore.normal[0]+f.normal[1]*fore.normal[1]>.995;
        if (f.length < 1.65 || !detail && !waterfront) return;
        const n = Math.max(1,Math.round(f.length/(detail ? 3.02 : 4.35)));
        for (let j = 0; j < n; j++) {
          const u = f.length * (j+.5)/n, span = Math.min(f.length/n*.64,1.95);
          const options={frameSlot:'surround',glass:window,frame:pale,frameWidth:detail > 1 ? .105 : 0,d:.031};
          opening(out,f,u,10.47,span,2.76,{...options,head:waterfront && detail>0?'round':'flat'});
          opening(out,f,u,14.55,span*.84,2.37,{...options,mullions:detail === 3 ? 1 : 0});
          if (waterfront && j && detail > 0) {
            const q = f.length * j/n;
            fbox(out,'surround',f,q-.13,q+.13,9.74,17.65,0,.17,pale);
          }
        }
        if (waterfront && f.length > 6) {
          fbox(out,'surround',f,.21,f.length-.21,13.95,14.19,.019,1.12,cream);
          fbox(out,'iron',f,.21,f.length-.21,14.94,15.015,1.023,1.123,iron);
          if (detail) {
            const m = Math.ceil(f.length/(detail>1?.58:1.35));
            for (let j=0;j<m;j++) {
              const u = Math.max(.21,f.length*(j+.5)/m);
              if (detail === 3) fbox(out,'iron',f,u-.04,u+.04,14.18,14.96,1.028,1.096,iron);
              else {
                const p=f.P;
                quad4(out,'iron',p(u-.038,14.18,1.09),p(u+.038,14.18,1.09),
                  p(u+.038,14.96,1.09),p(u-.038,14.96,1.09),iron);
              }
            }
          }
        }
      }, inner);
    }
    cap(out,'tile',rings,upperWallHeight+.05,roof);
  }
}

function seawall(out, detail) {
  const { ramparts, seaLevel } = site;
  const levels = [seaLevel+.78, seaLevel+2.2];
  cap(out,'rampart',[site.waterfront],levels[0],stones[2]);
  const normals=ramparts.slice(1).map((b,i)=>wallFace(ramparts[i].point,b.point).normal);
  const points=ramparts.map(({ point:[x,z] },i)=>{
    const a=normals[Math.max(0,i-1)], b=normals[Math.min(i,normals.length-1)];
    const m=Math.max(.56,1+a[0]*b[0]+a[1]*b[1]);
    return (y,d)=>[x+(a[0]+b[0])*d/m,y,z+(a[1]+b[1])*d/m];
  });
  for (let i=1;i<ramparts.length;i++) {
    const a = ramparts[i-1], b = ramparts[i], start=points[i-1], end=points[i];
    const stone = stones[(i-1)%stones.length];
    const face = (y, Y, d, D, color) => quad4(out,'rampart',start(y,d),end(y,d),end(Y[1],D),start(Y[0],D),color);
    face(levels[0],[levels[1],levels[1]],2.05,1.66,stones[1]);
    face(levels[1],[a.crest,b.crest],1.66,.32,stone);
    quad4(out,'rampart',start(a.crest-.07,.39),end(b.crest-.07,.39),
      end(b.crest+.17,-.6),start(a.crest+.17,-.6),stones[2]);
    if (detail < 2) continue;
    for (let k=1;k<=6;k++) {
      const s=k/7, d=1.66+(.32-1.66)*s+.018;
      const y0=levels[1]+(a.crest-levels[1])*s, y1=levels[1]+(b.crest-levels[1])*s;
      quad4(out,'rampart',start(y0,d),end(y1,d),end(y1+.031,d),start(y0+.031,d),stones[(i+1)%stones.length]);
    }
  }
}

function build(out, detail) {
  fort(out,detail);
  turrets(out,detail);
  palace(out,detail);
  seawall(out,detail);
}

export const buildSkyline = (out) => build(out,0);
export const buildDistrict = (out) => build(out,1);
export const buildStreet = (out) => build(out,2);
export const buildCloseup = (out) => build(out,3);
export const buildMaster = buildCloseup;
