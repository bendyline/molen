/** Entire original mapped water-storage tank; exterior height and finish estimated. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { beam, normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P=JSON.parse(fs.readFileSync(new URL('../plan-controls.json',import.meta.url)));
export const surfaces={wall:{slot:'wall',graph:'metal_corrugated',roughness:.83,metallic:.35},roof:{slot:'roof',graph:'metal_painted',roughness:.8,metallic:.3},trim:{slot:'trim',graph:'metal_painted',roughness:.76,metallic:.4},foundation:{slot:'foundation',graph:'concrete_plain',roughness:.98,metallic:0},lid:{slot:'door',graph:'metal_painted',roughness:.8,metallic:.25}};
const colors={wall:rgb('a9b5b0'),roof:rgb('9daaa6'),trim:rgb('7b908d'),foundation:rgb('969b88'),lid:rgb('afbbb3')};
export const componentEvidence=[];
function face(o,k,p,n){let normal=normalFor(...p);if(n&&normal.reduce((s,v,i)=>s+v*n[i],0)<0){p=[...p].reverse();normal=normalFor(...p);}o.addConvexPolygon(k,'palette:#ffffff',p,normal,q=>[q[0],q[1]],colors[k]);}
function cap(o,k,r,y,up){const b=new MeshBufferBuilder();if(!b.addCap(k,'palette:#ffffff',r,[],()=>y,[0,up,0],p=>p,colors[k]))throw Error('Invalid tank cap');const m=b.finalize();for(let i=0;i<m.indices.length;i+=3)face(o,k,Array.from(m.indices.slice(i,i+3)).map(j=>Array.from(m.positions.slice(j*3,j*3+3))),[0,up,0]);}
function polygon(o,k,r,y0,y1){const sign=Math.sign(r.reduce((s,a,i)=>{const b=r[(i+1)%r.length];return s+a[0]*b[1]-a[1]*b[0];},0));for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];face(o,k,[[a[0],y0,a[1]],[b[0],y0,b[1]],[b[0],y1,b[1]],[a[0],y1,a[1]]],[(b[1]-a[1])*sign,0,-(b[0]-a[0])*sign]);}cap(o,k,r,y0,-1);cap(o,k,r,y1,1);}
function ring(o,k,r,y,width,height){for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];beam(o,k,[a[0],y,a[1]],[b[0],y,b[1]],width,height,colors[k]);}}
const disk=(radius,count)=>Array.from({length:count},(_,i)=>[radius*Math.cos(i*2*Math.PI/count),radius*Math.sin(i*2*Math.PI/count)]);
export function buildHouse(o,_f,lod=3){
 componentEvidence.length=0;const R=P.nativeRing;
 polygon(o,'foundation',R,P.foundationBottom,P.floor);
 polygon(o,'wall',R,P.floor,P.eave);
 const roofRing=R.map(([x,z])=>[x*1.012,z*1.012]);
 for(let i=0;i<roofRing.length;i++){const a=roofRing[i],b=roofRing[(i+1)%roofRing.length];face(o,'roof',[[a[0],P.eave,a[1]],[b[0],P.eave,b[1]],[0,P.roofApex,0]],[0,1,0]);}
 for(const y of [P.floor+.15,1.4,P.eave-.05])ring(o,'trim',R,y,.055,.07);
 polygon(o,'lid',disk(.28,8),P.roofApex-.018,P.roofApex+.035);
 const xmax=Math.max(...R.map(p=>p[0]));
 beam(o,'trim',[xmax+.07,P.floor+.04,0],[xmax+.07,P.eave-.1,0],.085,.085,colors.trim);
 beam(o,'trim',[xmax+.07,P.eave-.1,0],[xmax-.18,P.eave-.1,0],.085,.085,colors.trim);
 if(lod>0){
  const stride=[Infinity,4,2,1][lod];
  for(let i=0;i<roofRing.length;i+=stride){const a=roofRing[i];beam(o,'roof',[a[0],P.eave+.009,a[1]],[a[0]*.13,P.roofApex-.035,a[1]*.13],.016,.016,colors.roof);}
  beam(o,'trim',[-.13,P.roofApex+.07,0],[.13,P.roofApex+.07,0],.025,.025,colors.trim);
  for(const x of[-.13,.13])beam(o,'trim',[x,P.roofApex+.03,0],[x,P.roofApex+.07,0],.025,.025,colors.trim);
 }
 componentEvidence.push({lod,wholeIndependentWaterTank:true,nativeControls:R.length,allExteriorWalls:true,wholeClosedRoof:true,foundation:true,reinforcingCollars:3,closedAccessLid:true,estimatedServicePipe:true,allHeightRoofAndFinishEstimated:true,notWholeObservatoryProxy:true});
}
export const houseSkyline=(o,f)=>buildHouse(o,f,0),houseDistrict=(o,f)=>buildHouse(o,f,1),houseStreet=(o,f)=>buildHouse(o,f,2),houseCloseup=(o,f)=>buildHouse(o,f,3);
const root='content/worldgen/source/places/qe/qe6/murchison_western_water_tank',camera=[9,6,10],look=[0,1.3,0];
export const houseModel={id:P.model,key:P.model,cell:P.cell,title:P.title,recipe:'house-model.mjs',surfaces,build:buildHouse,category:'landmark',quality:'medium-fi-exterior',reviewStatus:'review-in-qa.json',geographicStatus:'historical-proposal',orientationPolicy:'approximate-visualization',progressLedger:'qualla-002.PROGRESS.md',brief:P.limitations.join(' '),appearance:{kind:'historical',representedDate:P.representedDate,validFrom:P.validFrom,validUntil:P.validUntil,currentWorldEligible:false},camera,lookAt:look,portableGroundY:-.43,mediumFiContext:{scale:1,groundY:0,terrain:{descriptor:'terrain-review.terrain.json',heightmap:'terrain-review.height.png'}},embeddedCanonicalGraphs:['metal_corrugated','metal_painted','concrete_plain'],qaCameras:[{name:'whole-tank-roof-collars-and-side-pipe',position:camera,lookAt:look},{name:'opposite-tank-and-closed-access-lid',position:[-8,6,-9],lookAt:look}],qaLodCameras:['skyline','district','street','closeup'].map(reviewLod=>({name:'whole-water-tank-'+reviewLod,position:camera,lookAt:look,reviewLod})),runtimeLodOverlay:{module:root+'/models/house-model.mjs',level:'skyline',export:'houseSkyline',errorMeters:.12,surfaces,authoredLevels:{district:{export:'houseDistrict',errorMeters:.08,surfaces},street:{export:'houseStreet',errorMeters:.035,surfaces},closeup:{export:'houseCloseup',errorMeters:.005,surfaces}}},limitations:P.limitations,sourceLicense:'Original deterministic procedural geometry under repository license. Original OSM numerical19corner water/storage-tank record creditedODbL; every source photograph/diagram/map image/texture unused. Height, shallow roof, corrugated-metal appearance, accesslid/servicepipe and historic survival explicitly estimated.'};
