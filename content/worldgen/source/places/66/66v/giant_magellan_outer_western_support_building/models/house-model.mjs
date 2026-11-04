/** Whole original GMT support outline; learned height and explicitly estimated modular exterior. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces={wall:{slot:'wall',graph:'metal_painted',roughness:.86,metallic:.1},roof:{slot:'roof',graph:'metal_corrugated',roughness:.84,metallic:.2},trim:{slot:'trim',graph:'metal_painted',roughness:.78,metallic:.25},glass:{slot:'trim',graph:'metal_painted',roughness:.38,metallic:.15},foundation:{slot:'foundation',graph:'concrete_plain',roughness:.98,metallic:0}};
const colors={wall:rgb('d9dbd1'),roof:rgb('92958c'),trim:rgb('77827b'),glass:rgb('283b44'),foundation:rgb('aba89b')};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let v = normalFor(...p);
  if (n && v.reduce((s, a, i) => s + a * n[i], 0) < 0) {
    p = [...p].reverse();
    v = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, v, (q) => [q[0], q[1]], tint);
}
function cap(o, k, r, y, up, tint = colors[k]) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      r,
      [],
      (p) => (typeof y === 'function' ? y(p) : y),
      [0, up, 0],
      (p) => p,
      tint,
    )
  )
    throw Error('Invalid LIDAR cap');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    face(
      o,
      k,
      Array.from(m.indices.slice(i, i + 3)).map((j) =>
        Array.from(m.positions.slice(j * 3, j * 3 + 3)),
      ),
      [0, up, 0],
      tint,
    );
}
function prism(o, k, r, y0, y1, tint = colors[k]) {
  const sg = Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      top = (p) => (typeof y1 === 'function' ? y1(p) : y1);
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], top(b), b[1]],
        [a[0], top(a), a[1]],
      ],
      [(b[1] - a[1]) * sg, 0, -(b[0] - a[0]) * sg],
      tint,
    );
  }
  cap(o, k, r, y0, -1, tint);
  cap(o, k, r, y1, 1, tint);
}
const rect = (x0, x1, z0, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  box = (o, k, x, z, w, d, y0, y1, tint) =>
    prism(o, k, rect(x - w / 2, x + w / 2, z - d / 2, z + d / 2), y0, y1, tint),
  strut = (o, k, a, b, w = 0.05, tint = colors[k]) => beam(o, k, a, b, w, w, tint);

function clip(r,z0,sign){const q=[];for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],da=(a[1]-z0)*sign,db=(b[1]-z0)*sign;if(da>=0)q.push(a);if((da>0&&db<0)||(da<0&&db>0)){const t=(z0-a[1])/(b[1]-a[1]);q.push([a[0]+(b[0]-a[0])*t,z0])}}return q;}
function edgePanel(o,k,a,b,t,n,width,depth,y0,y1,offset){const x=a[0]+(b[0]-a[0])*t+n[0]*offset,z=a[1]+(b[1]-a[1])*t+n[1]*offset,dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),u=[dx/L,dz/L],r=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sz])=>[x+u[0]*sx*width/2+n[0]*sz*depth/2,z+u[1]*sx*width/2+n[1]*sz*depth/2]);prism(o,k,r,y0,y1)}
export function buildHouse(o,_f,lod=3){componentEvidence.length=0;const r=P.nativeRing,zmin=Math.min(...r.map(p=>p[1])),zmax=Math.max(...r.map(p=>p[1])),zm=(zmin+zmax)/2,half=(zmax-zmin)/2,roofY=p=>P.roofTop-P.roofRise*Math.abs(p[1]-zm)/half,sg=Math.sign(r.reduce((s,p,i)=>{const q=r[(i+1)%r.length];return s+p[0]*q[1]-q[0]*p[1]},0)),floorStep=(P.eave-P.floor)/P.storeys;
prism(o,'foundation',r,P.foundationBottom,P.floor);prism(o,'wall',r,P.floor,P.eave);for(const sign of[-1,1])cap(o,'roof',clip(r,zm,sign),roofY,1);
for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),n=[dz/L*sg,-dx/L*sg],parts=[a];if((a[1]-zm)*(b[1]-zm)<0){const t=(zm-a[1])/(b[1]-a[1]);parts.push([a[0]+dx*t,zm]);}parts.push(b);for(let j=0;j<parts.length-1;j++){const a=parts[j],b=parts[j+1];if(Math.max(roofY(a),roofY(b))-P.eave<1e-6)continue;const p=[[a[0],P.eave,a[1]],[b[0],P.eave,b[1]],[b[0],roofY(b),b[1]],[a[0],roofY(a),a[1]]].filter((p,k,q)=>k===0||Math.hypot(...p.map((v,j)=>v-q[k-1][j]))>1e-8);if(p.length>2&&Math.hypot(...p[0].map((v,j)=>v-p.at(-1)[j]))<1e-8)p.pop();if(p.length>=3)face(o,'wall',p,[n[0],0,n[1]]);}
if(lod===0){for(let f=0;f<P.storeys;f++)edgePanel(o,'glass',a,b,.5,n,L*.86,.025,P.floor+f*floorStep+.9,P.floor+f*floorStep+1.9,.025);continue;}
const count=Math.max(1,Math.floor(L/P.windowSpacing));for(let f=0;f<P.storeys;f++)for(let j=0;j<count;j++){const t=(j+.5)/count;if(f===0&&i===P.entryEdge&&Math.abs(t-.5)*L<1.8)continue;const y=P.floor+f*floorStep+.85,w=P.windowWidth,h=P.windowHeight;edgePanel(o,'glass',a,b,t,n,w,.025,y,y+h,.035);if(lod>=2){edgePanel(o,'trim',a,b,t,n,w+.14,.12,y-.07,y,.075);edgePanel(o,'trim',a,b,t,n,w+.14,.12,y+h,y+h+.07,.075);for(const side of[-1,1])edgePanel(o,'trim',a,b,t+side*(w/2+.035)/L,n,.07,.12,y,y+h,.075);}if(lod>=3){edgePanel(o,'trim',a,b,t,n,.035,.065,y,y+h,.075);edgePanel(o,'trim',a,b,t,n,w,.065,y+.38,y+.415,.075);}}
if(lod>=2&&L>12)for(let j=1;j<count;j++)edgePanel(o,'trim',a,b,j/count,n,.009,.018,P.floor+.1,P.eave-.08,.012);
if(lod>=2&&Math.abs(dz)<Math.abs(dx)*.1)strut(o,'trim',[a[0]+n[0]*.04,P.eave-.035,a[1]+n[1]*.04],[b[0]+n[0]*.04,P.eave-.035,b[1]+n[1]*.04],.045);
}
const a=r[P.entryEdge],b=r[(P.entryEdge+1)%r.length],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),n=[dz/L*sg,-dx/L*sg];edgePanel(o,'glass',a,b,.5,n,1.6,.035,P.floor+.02,P.floor+2.15,.045);if(lod>=1){edgePanel(o,'trim',a,b,.5,n,1.85,.07,P.floor+2.15,P.floor+2.25,.07);edgePanel(o,'roof',a,b,.5,n,2.15,1.15,P.floor+2.35,P.floor+2.42,.58);edgePanel(o,'foundation',a,b,.5,n,2.2,.95,P.floor-.2,P.floor,.5);}if(lod>=2)edgePanel(o,'trim',a,b,.5,n,.04,.075,P.floor+.02,P.floor+2.15,.08);
componentEvidence.push({lod,wholeOriginalSourceRing:true,originalCorners:r.length,closedWalls:true,closedRoof:true,foundation:true,assumedStoreys:P.storeys,roofHeightAboveFloor:P.roofTop-P.floor,estimatedEntry:true,notUnbuiltEnclosure:true,notWholeProjectProxy:true});}
export const houseSkyline=(o,f)=>buildHouse(o,f,0),houseDistrict=(o,f)=>buildHouse(o,f,1),houseStreet=(o,f)=>buildHouse(o,f,2),houseCloseup=(o,f)=>buildHouse(o,f,3);
const root='content/worldgen/source/places/'+P.cell+'/'+P.model,span=Math.max(Math.max(...P.nativeRing.map(p=>p[0]))-Math.min(...P.nativeRing.map(p=>p[0])),Math.max(...P.nativeRing.map(p=>p[1]))-Math.min(...P.nativeRing.map(p=>p[1])),(P.roofTop-P.floor)*1.8),camera=[span*.85,P.floor+span*.42,span*.8],look=[0,P.floor+(P.roofTop-P.floor)*.45,0];
export const houseModel={id:P.model,wikidataId:'Q652252',key:P.model,cell:P.cell,title:P.title,recipe:'house-model.mjs',surfaces,build:buildHouse,category:'landmark',quality:'medium-fi-exterior',reviewStatus:'review-in-qa.json',geographicStatus:'historical-proposal',groundContactBasis:'Own source field fixed before initial corner-based nominal floor and retaining-base sections. Coarse hill grade is not a surveyed historic terrace; exact registration is approximate. Source frame/field remain unchanged.',orientationPolicy:'approximate-visualization',progressLedger:'qualla-002.PROGRESS.md',brief:P.limitations.join(' '),appearance:{kind:'historical',representedDate:P.representedDate,validFrom:P.validFrom,validUntil:P.validUntil,currentWorldEligible:false},camera,lookAt:look,portableGroundY:P.floor-.18,mediumFiContext:{scale:.12,groundY:0,terrain:{descriptor:'terrain-review.terrain.json',heightmap:'terrain-review.height.png'}},embeddedCanonicalGraphs:['metal_painted','metal_corrugated','concrete_plain'],qaCameras:[{name:'whole-native-outline-estimated-modular-exterior',position:camera,lookAt:look},{name:'whole-opposite-facade-and-original-returns',position:[-span*.9,P.floor+span*.5,-span*.85],lookAt:look}],qaLodCameras:['skyline','district','street','closeup'].map(reviewLod=>({name:'whole-support-building-'+reviewLod,position:camera,lookAt:look,reviewLod})),runtimeLodOverlay:{module:root+'/models/house-model.mjs',level:'skyline',export:'houseSkyline',errorMeters:1.2,surfaces,authoredLevels:{district:{export:'houseDistrict',errorMeters:.45,surfaces},street:{export:'houseStreet',errorMeters:.08,surfaces},closeup:{export:'houseCloseup',errorMeters:.001,surfaces}}},limitations:P.limitations,sourceLicense:'Original procedural geometry under repository license. Google Open Buildings and temporal numerical height data CC-BY4.0, original operator factual text and open elevation credited separately. Every reference appearance image unused.'};
