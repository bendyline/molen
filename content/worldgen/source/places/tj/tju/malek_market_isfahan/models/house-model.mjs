/** Whole Malek Market; exact native outline, explicitly estimated roof/facade. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {MeshBufferBuilder} from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {beam,normalFor} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {rgb} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P=JSON.parse(fs.readFileSync(new URL('../plan-controls.json',import.meta.url))),R=P.nativeRing;
export const surfaces={wall:{slot:'wall',graph:'brick',roughness:.95,metallic:0},roof:{slot:'roof',graph:'plaster_lime',roughness:.98,metallic:0},base:{slot:'foundation',graph:'stone_sandstone',roughness:.96,metallic:0},door:{slot:'door',graph:'wood_plain',roughness:.9,metallic:0}};
const colors={wall:rgb('bf9b73'),roof:rgb('c4ae8a'),base:rgb('ad9974'),door:rgb('544635')};
export const componentEvidence=[];
function face(o, k, p, n, tint = colors[k]) {
  let no = normalFor(...p);
  if (n && no.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    no = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, no, (q) => [q[0], q[1]], tint);
}
function cap(o, k, outer, holes, y, up) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      outer,
      holes,
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid whole Malek Market cap');
  const m = b.finalize();
  for(let i=0;i<m.indices.length;i+=3){
    const pts=Array.from(m.indices.slice(i,i+3)).map(j=>Array.from(m.positions.slice(j*3,j*3+3)));
    const a=pts[1].map((v,k)=>v-pts[0][k]),b=pts[2].map((v,k)=>v-pts[0][k]);
    // Aligned polygon-hole bridges can collapse only after Float32 encoding.
    // Discard those zero-area faces without changing any roof or native control.
    if(Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])<1e-10)continue;
    face(o,k,pts,[0,up,0]);
  }
}
const area = (r) =>
  r.reduce((s, a, i) => {
    const b = r[(i + 1) % r.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
function walls(o, k, r, y0, y1, inside = false, skip = []) {
  const sign = Math.sign(area(r)) * (inside ? -1 : 1);
  for (let i = 0; i < r.length; i++) {
    if (skip.includes(i)) continue;
    const a = r[i],
      b = r[(i + 1) % r.length];
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [(b[1] - a[1]) * sign, 0, -(b[0] - a[0]) * sign],
    );
  }
}
function local(a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  return {
    L,
    t,
    point: (u, y, n = 0) => [a[0] + t[0] * u - t[1] * n, y, a[1] + t[1] * u + t[0] * n],
  };
}
function blockOn(o, k, a, b, u0, u1, y0, y1, n0, n1) {
  const p = local(a, b).point;
  const r = [
    [u0, n0],
    [u1, n0],
    [u1, n1],
    [u0, n1],
  ].map(([u, n]) => p(u, 0, n));
  const rr = r.map((p) => [p[0], p[2]]);
  walls(o, k, rr, y0, y1);
  cap(o, k, rr, [], y0, -1);
  cap(o, k, rr, [], y1, 1);
}
function dome(o, c, lod) {
  const N = [4, 6, 10, 16][lod],
    K = [1, 1, 3, 4][lod],
    tmax = Math.acos(P.oculusRadius / P.vaultRadius),
    point = (j, i, inner = false) => {
      const t = (tmax * j) / K,
        a = (2 * Math.PI * i) / N,
        r = P.vaultRadius * Math.cos(t);
      return [
        c[0] + r * Math.cos(a),
        P.vaultBase + P.vaultRise * Math.sin(t) - (inner ? 0.12 : 0),
        c[1] + r * Math.sin(a),
      ];
    };
  if(lod===0){for(let i=0;i<N;i++)face(o,'roof',[point(0,i),point(0,i+1),[c[0],P.vaultBase+P.vaultRise,c[1]]],[0,1,0]);return;}
  for (let j = 0; j < K; j++)
    for (let i = 0; i < N; i++) {
      const pts = [point(j, i), point(j, i + 1), point(j + 1, i + 1), point(j + 1, i)],
        mid = pts.reduce((a, p) => a.map((v, k) => v + p[k] / 4), [0, 0, 0]);
      face(o, 'roof', pts, [mid[0] - c[0], Math.max(0.3, mid[1] - P.vaultBase), mid[2] - c[1]]);
      if (lod > 1)
        face(
          o,
          'wall',
          [
            point(j, i, true),
            point(j + 1, i, true),
            point(j + 1, i + 1, true),
            point(j, i + 1, true),
          ],
          [-(mid[0] - c[0]), -0.4, -(mid[2] - c[1])],
        );
    }
  for (let i = 0; i < N; i++)
    face(
      o,
      'base',
      [point(K, i), point(K, i + 1), point(K, i + 1, true), point(K, i, true)],
      [0, 1, 0],
    );
}


// Court proportions and arcade rhythm are authored estimates; written evidence supplies the two-storey type.
function courtGalleries(o,lod){
 const court=P.estimatedCourt;
 for(let e=0;e<court.length;e++){
  const a=court[e],b=court[(e+1)%court.length],v=local(a,b),L=v.L,n=[-v.t[1],0,v.t[0]],pt=v.point;
  for(const y of [P.floor,P.secondFloor]){
   for(let bay=0;bay<3;bay++){
    const lo=L*bay/3,hi=L*(bay+1)/3,left=lo+.28,right=hi-.28,w=right-left;
    blockOn(o,'wall',a,b,lo,left,y,y+3,-P.galleryDepth,0);
    if(bay===2)blockOn(o,'wall',a,b,right,hi,y,y+3,-P.galleryDepth,0);
    face(o,'wall',[pt(left,y,-P.galleryDepth),pt(right,y,-P.galleryDepth),pt(right,y+3,-P.galleryDepth),pt(left,y+3,-P.galleryDepth)],n);
    const parts=[2,3,5,7][lod],arch=t=>y+1.55+.95*(.5*(1-Math.abs(2*t-1))+.5*Math.sin(Math.PI*t));
    for(let i=0;i<parts;i++){
     const ta=i/parts,tb=(i+1)/parts,ua=left+w*ta,ub=left+w*tb,ya=arch(ta),yb=arch(tb);
     face(o,'wall',[pt(ua,ya),pt(ub,yb),pt(ub,y+3),pt(ua,y+3)],n);
     face(o,'wall',[pt(ua,ya),pt(ua,ya,-P.galleryDepth),pt(ub,yb,-P.galleryDepth),pt(ub,yb)],[0,-1,0]);
     if(lod>1)beam(o,'base',pt(ua,ya+.06,.025),pt(ub,yb+.06,.025),.1,.09,colors.base);
    }
    if(lod>0){const mid=(left+right)/2,door=[pt(mid-.65,y+.08,-P.galleryDepth+.02),pt(mid-.65,y+1.8,-P.galleryDepth+.02),pt(mid,y+2.2,-P.galleryDepth+.02),pt(mid+.65,y+1.8,-P.galleryDepth+.02),pt(mid+.65,y+.08,-P.galleryDepth+.02)];face(o,'door',door,n);}
   }
  }
  blockOn(o,'base',a,b,0,L,P.secondFloor-.17,P.secondFloor,-P.galleryDepth,.04);
  if(lod>0)blockOn(o,'base',a,b,0,L,P.secondFloor,P.secondFloor+.55,-.12,.035);
 }
}

export function buildHouse(o,_f,lod=3){componentEvidence.length=0;const N=[4,6,10,16][lod],holes=P.vaultCentres.map(c=>Array.from({length:N},(_,i)=>[c[0]+P.vaultRadius*Math.cos(i*2*Math.PI/N),c[1]+P.vaultRadius*Math.sin(i*2*Math.PI/N)]));walls(o,'base',R,P.foundationBottom,P.floor);cap(o,'base',R,[],P.foundationBottom,-1);cap(o,'base',R,[],P.floor,1);walls(o,'wall',R,P.floor,P.roofTop);cap(o,'roof',R,[P.estimatedCourt,...holes],P.roofTop,1);courtGalleries(o,lod);for(const c of P.vaultCentres)dome(o,c,lod);
let entries=0;const sg=Math.sign(area(R));for(let i=0;i<R.length;i++){const a=R[i],b=R[(i+1)%R.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/L,(b[1]-a[1])/L],n=[u[1]*sg,-u[0]*sg],pt=(t,y,depth=.04)=>[a[0]+u[0]*t+n[0]*depth,y,a[1]+u[1]*t+n[1]*depth];if(lod>0)beam(o,'roof',pt(0,P.parapetTop-.11,0),pt(L,P.parapetTop-.11,0),.22,.22,colors.roof);if(L<12)continue;const t=L*.5,w=Math.min(3.4,L*.3),count=[2,4,6,10][lod],curve=Array.from({length:count+1},(_,j)=>{const s=j/count;return[-w/2+w*s,1.7+.8*(1-Math.abs(2*s-1))*.5+.8*Math.sin(Math.PI*s)*.5]}),poly=[pt(t-w/2,P.floor+.08),...curve.map(([x,y])=>pt(t+x,y)),pt(t+w/2,P.floor+.08)];face(o,'door',poly,[n[0],0,n[1]]);entries++;if(lod>=1){for(const x of[-w/2,w/2])beam(o,'base',pt(t+x,P.floor+.05,.09),pt(t+x,1.7,.09),.18,.14,colors.base);for(let j=1;j<curve.length;j++)beam(o,'base',pt(t+curve[j-1][0],curve[j-1][1]+.1,.09),pt(t+curve[j][0],curve[j][1]+.1,.09),.18,.14,colors.base);}if(lod>=2){const bays=Math.floor(L/7);for(let j=1;j<bays;j++){const v=L*j/bays;if(Math.abs(v-t)<w/2+.3)continue;beam(o,'wall',pt(v,P.floor+.1,.05),pt(v,P.roofTop-.2,.05),.22,.16,rgb('a17e56'));}if(lod===3)for(const x of[-.65,0,.65])beam(o,'door',pt(t+x,.5,.1),pt(t+x,2.5,.1),.05,.045,rgb('837050'));}}
componentEvidence.push({lod,originalOuterControls:R.length,wholeBody:true,allOuterWalls:true,completeRoof:true,estimatedVaultBays:P.vaultCentres.length,openOculi:lod===0?0:P.vaultCentres.length,fullFoundation:true,closedArchedEntries:entries,unknownUnmappedCourtsExplicit:true,openEstimatedCourt:true,twoStoreys:true,arcadedGalleryLevels:2,notWholeGrandBazaarProxy:true});}
export const houseSkyline=(o,f)=>buildHouse(o,f,0),houseDistrict=(o,f)=>buildHouse(o,f,1),houseStreet=(o,f)=>buildHouse(o,f,2),houseCloseup=(o,f)=>buildHouse(o,f,3);
const root='content/worldgen/source/places/'+P.cell+'/'+P.model,camera=[48,42,55],look=[0,3,0];export const houseModel={id:P.model,key:P.model,cell:P.cell,title:P.title,recipe:'house-model.mjs',surfaces,build:buildHouse,category:'landmark',quality:'medium-fi-exterior',reviewStatus:'review-in-qa.json',geographicStatus:'historical-proposal',orientationPolicy:'approximate-visualization',progressLedger:'qualla-002.PROGRESS.md',brief:'Whole5cornerMalekMarket/allouterwalls/fullroof/base.14 estimated peripheral vaults, an estimated open central court with two storeys of arcaded galleries, and closed arched exterior entries fromclearedCosteconstructionvocabulary; exactrooflayout/heights/hiddeninnercourts/currentfinish unmeasured. Separatewholemarket, notGrandBazaar2kmproxy.',appearance:{kind:'historical',representedDate:P.representedDate,validFrom:P.validFrom,validUntil:P.validUntil,currentWorldEligible:false},camera,lookAt:look,portableGroundY:P.foundationBottom-.03,mediumFiContext:{scale:1,groundY:0,terrain:{descriptor:'terrain-review.terrain.json',heightmap:'terrain-review.height.png'}},embeddedCanonicalGraphs:['brick','plaster_lime','stone_sandstone','wood_plain'],qaCameras:[{name:'whole-five-corner-market-and-vaulted-roof',position:[45,39,52],lookAt:look},{name:'two-storey-court-galleries-vaults-and-oculi-detail',position:[-18,25,20],lookAt:[0,2,0]}],qaLodCameras:['skyline','district','street','closeup'].map(reviewLod=>({name:'whole-malek-market-building-'+reviewLod,position:camera,lookAt:look,reviewLod})),runtimeLodOverlay:{module:root+'/models/house-model.mjs',level:'skyline',export:'houseSkyline',errorMeters:1.2,surfaces,authoredLevels:{district:{export:'houseDistrict',errorMeters:.9,surfaces},street:{export:'houseStreet',errorMeters:.2,surfaces},closeup:{export:'houseCloseup',errorMeters:.01,surfaces}}},limitations:P.limitations,sourceLicense:'Originalproceduralgeometry/repositorylicense. OriginalcompleteOSM5cornernumericplanODbL; samealreadyclearedpublishedCoste1840engraving/death1879/1867publication publicdomain forconstructionvocabulary only. No exteriorphoto/colour/surveyclaim, questionedimagery or phototextures.'};
