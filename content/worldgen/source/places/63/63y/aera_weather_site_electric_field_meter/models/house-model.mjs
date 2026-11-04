/** Independent older AERAWS CS110; support and body pose explicitly estimated. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces={steel:{slot:'trim',graph:'metal_stainless_beadblasted',roughness:.7,metallic:.65},casing:{slot:'wall',graph:'metal_painted',roughness:.82,metallic:.2},dark:{slot:'trim',graph:'metal_painted',roughness:.85,metallic:0},foundation:{slot:'foundation',graph:'concrete_plain',roughness:.98,metallic:0}};
const colors={steel:rgb('a8b0af'),casing:rgb('d5d9d4'),dark:rgb('323b3e'),foundation:rgb('a6a494')};
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

function cylinder(o,k,x,z,r,y0,y1,n){prism(o,k,Array.from({length:n},(_,i)=>[x+r*Math.cos(i*2*Math.PI/n),z+r*Math.sin(i*2*Math.PI/n)]),y0,y1)}
export function buildHouse(o,_f,lod=3){componentEvidence.length=0;const n=[6,8,12,16][lod],sx=P.sensorOffset,y=P.sensorFaceHeight;
cylinder(o,'steel',0,0,P.mastDiameter/2,.025,P.mastTop,n);
for(let i=0;i<3;i++){const a=i*2*Math.PI/3,x=P.standRadius*Math.cos(a),z=P.standRadius*Math.sin(a);strut(o,'steel',[x,.055,z],[0,P.standJoint,0],.035);box(o,'steel',x,z,.15,.12,.015,.055);box(o,'foundation',x,z,.2,.2,-.2,.015);if(lod>=1)strut(o,'steel',[x,.06,z],[0,.25,0],.018);if(lod>=2)cylinder(o,'steel',x+.035,z,.009,.055,.078,6)}
box(o,'casing',sx,0,P.sensorEnvelope[0],P.sensorEnvelope[1],y,y+P.sensorEnvelope[2]);strut(o,'steel',[0,1.98,0],[sx,1.98,0],.025);cylinder(o,'dark',sx,0,.064,y-.007,y+.004,n);
if(lod>=1){box(o,'steel',sx,0,.157,.157,y+.014,y+.030);box(o,'steel',sx,0,.16,.16,y+.419,y+.432);box(o,'steel',.015,0,.065,.065,1.93,2.01);strut(o,'dark',[0,.07,.033],[0,1.94,.033],.009);strut(o,'dark',[0,1.94,.033],[sx,1.94,.083],.009)}
if(lod>=2){for(const z of[-.055,.055])cylinder(o,'steel',sx,z,.006,y+.432,y+.44,6);box(o,'dark',sx+.08,.03,.022,.025,y+.32,y+.36);strut(o,'steel',[sx-.07,y+.055,.08],[sx-.07,y+.14,.08],.009);box(o,'dark',.03,0,.02,.02,1.75,1.78)}
if(lod>=3){for(let i=0;i<4;i++)box(o,'dark',sx-.078,0,.004,.072,y+.24+i*.018,y+.244+i*.018);strut(o,'dark',[sx+.09,y+.34,.03],[sx+.13,y+.26,.03],.008);strut(o,'dark',[sx+.13,y+.26,.03],[0,1.88,.04],.008)}
cylinder(o,'steel',-.75,-.3,.012,-.5,.07,6);if(lod>=1)strut(o,'dark',[-.75,.065,-.3],[0,.07,0],.01);
componentEvidence.push({lod,wholeIndependentMeter:true,serial:1061,sensorFaceHeight:1.75,closedSensorBody:true,estimatedStand:true,standLegs:3,otherWeatherSensorsNotClaimed:true,noNewNetworkTripodClaim:true,notWholeObservatoryProxy:true});}
export const houseSkyline=(o,f)=>buildHouse(o,f,0),houseDistrict=(o,f)=>buildHouse(o,f,1),houseStreet=(o,f)=>buildHouse(o,f,2),houseCloseup=(o,f)=>buildHouse(o,f,3);
const root='content/worldgen/source/places/'+P.cell+'/'+P.model,camera=[4,2.8,5],look=[.1,1,0];
export const houseModel={id:P.model,wikidataId:'Q794886',key:P.model,cell:P.cell,title:P.title,recipe:'house-model.mjs',surfaces,build:buildHouse,category:'landmark',quality:'medium-fi-exterior',reviewStatus:'review-in-qa.json',geographicStatus:'historical-proposal',groundContactBasis:'NominalY0at the original rounded instrument point over its own unchanged source field. Support pads/ground rod partly buried; historic grading and exact vertical registration estimated.',orientationPolicy:'approximate-visualization',progressLedger:'qualla-002.PROGRESS.md',brief:P.limitations.join(' '),appearance:{kind:'historical',representedDate:P.representedDate,validFrom:P.validFrom,validUntil:P.validUntil,currentWorldEligible:false},camera,lookAt:look,portableGroundY:-.03,mediumFiContext:{scale:.12,groundY:0,terrain:{descriptor:'terrain-review.terrain.json',heightmap:'terrain-review.height.png'}},embeddedCanonicalGraphs:['metal_painted','metal_stainless_beadblasted','concrete_plain'],qaCameras:[{name:'whole-older-electric-field-meter-and-estimated-support',position:camera,lookAt:look},{name:'whole-meter-opposite-face-and-estimated-grounding',position:[-4,2.5,-5],lookAt:look}],qaLodCameras:['skyline','district','street','closeup'].map(reviewLod=>({name:'whole-older-electric-field-meter-'+reviewLod,position:camera,lookAt:look,reviewLod})),runtimeLodOverlay:{module:root+'/models/house-model.mjs',level:'skyline',export:'houseSkyline',errorMeters:.15,surfaces,authoredLevels:{district:{export:'houseDistrict',errorMeters:.06,surfaces},street:{export:'houseStreet',errorMeters:.025,surfaces},closeup:{export:'houseCloseup',errorMeters:.001,surfaces}}},limitations:P.limitations,sourceLicense:'Original procedural geometry under repository license. Original researcher numerical point/height and written facts, manufacturer written dimensions. Every source image unused. Open elevation data credited separately.'};
