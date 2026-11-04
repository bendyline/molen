/** Whole Unit 5 reactor: original written lower and upper dimensions, native upper-roof registration. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {MeshBufferBuilder} from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {beam,normalFor} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {rgb} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P=JSON.parse(fs.readFileSync(new URL('../plan-controls.json',import.meta.url)));
export const surfaces={wall:{slot:'wall',graph:'concrete_plain',roughness:.92,metallic:0},upper:{slot:'wall',graph:'metal_corrugated',roughness:.86,metallic:.18},roof:{slot:'roof',graph:'metal_painted',roughness:.85,metallic:.25},foundation:{slot:'foundation',graph:'concrete_plain',roughness:.95,metallic:0},steel:{slot:'trim',graph:'metal_painted',roughness:.68,metallic:.35}};
const colors={wall:rgb('cfd2cf'),upper:rgb('c0cbd0'),roof:rgb('9ca89f'),foundation:rgb('b3bcb2'),steel:rgb('8d9c92')},rect=(x0,x1,z0,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
export const componentEvidence=[];
function face(o,k,p,n,tint=colors[k]){let v=normalFor(...p);if(n&&v.reduce((s,a,i)=>s+a*n[i],0)<0){p=[...p].reverse();v=normalFor(...p)}o.addConvexPolygon(k,'palette:#ffffff',p,v,q=>[q[0],q[1]],tint)}
function cap(o,k,r,y,up,tint){const b=new MeshBufferBuilder();if(!b.addCap(k,'palette:#ffffff',r,[],p=>typeof y==='function'?y(p):y,[0,up,0],p=>p,tint??colors[k]))throw Error('Invalid warehouse cap');const m=b.finalize();for(let i=0;i<m.indices.length;i+=3)face(o,k,Array.from(m.indices.slice(i,i+3)).map(j=>Array.from(m.positions.slice(j*3,j*3+3))),[0,up,0],tint)}
function prism(o,k,r,y0,y1,tint){const sg=Math.sign(r.reduce((s,p,i)=>{const q=r[(i+1)%r.length];return s+p[0]*q[1]-p[1]*q[0]},0)),top=p=>typeof y1==='function'?y1(p):y1;for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];face(o,k,[[a[0],y0,a[1]],[b[0],y0,b[1]],[b[0],top(b),b[1]],[a[0],top(a),a[1]]],[(b[1]-a[1])*sg,0,(a[0]-b[0])*sg],tint)}cap(o,k,r,y0,-1,tint);cap(o,k,r,y1,1,tint)}
const box=(o,k,x,z,w,d,y0,y1,t)=>prism(o,k,rect(x-w/2,x+w/2,z-d/2,z+d/2),y0,y1,t),strut=(o,k,a,b,w=.07,t)=>beam(o,k,a,b,w,w,t??colors[k]);



function perimeter(o,ring,y0,y1,lod,step=4){const sg=Math.sign(ring.reduce((s,a,i)=>{const b=ring[(i+1)%ring.length];return s+a[0]*b[1]-a[1]*b[0]},0));let joints=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/L,(b[1]-a[1])/L],n=[u[1]*sg,-u[0]*sg],pt=(t,y,off=.06)=>[a[0]+u[0]*t+n[0]*off,y,a[1]+u[1]*t+n[1]*off];if(lod>=1){strut(o,'steel',pt(0,y0),pt(0,y1),.13);strut(o,'steel',pt(0,y1),pt(L,y1),.13);}if(lod>=2){const N=Math.ceil(L/(lod===3?step:step*2));for(let j=1;j<N;j++){strut(o,'steel',pt(L*j/N,y0+.05),pt(L*j/N,y1-.05),.035,rgb('9baeb4'));joints++;}}}return joints;}
function closedPanel(o,ring,i,t,w,y0,y1,lod,color){const a=ring[i],b=ring[(i+1)%ring.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/L,(b[1]-a[1])/L],sg=Math.sign(ring.reduce((s,a,i)=>{const b=ring[(i+1)%ring.length];return s+a[0]*b[1]-a[1]*b[0]},0)),n=[u[1]*sg,-u[0]*sg],pt=(x,y,d=.09)=>[a[0]+u[0]*x+n[0]*d,y,a[1]+u[1]*x+n[1]*d],lo=L*t-w/2,hi=lo+w;face(o,'steel',[pt(lo,y0),pt(hi,y0),pt(hi,y1),pt(lo,y1)],[n[0],0,n[1]],color);if(lod>=1)for(const[a,b]of[[pt(lo,y0,.13),pt(lo,y1,.13)],[pt(hi,y0,.13),pt(hi,y1,.13)],[pt(lo,y1,.13),pt(hi,y1,.13)]])strut(o,'steel',a,b,.12);}


export function buildHouse(o,_f,lod=3){
 componentEvidence.length=0;
 prism(o,'foundation',P.lowerRing,P.foundationBottom,P.floor);
 prism(o,'wall',P.lowerRing,P.floor,P.lowerRoof-.20);
 prism(o,'roof',P.lowerRing,P.lowerRoof-.20,P.lowerRoof);
 prism(o,'wall',P.upperRing,P.lowerRoof,P.concreteTop);
 prism(o,'upper',P.upperRing,P.concreteTop,P.mainRoof-.25);
 prism(o,'roof',P.upperRing,P.mainRoof-.25,P.mainRoof);
 const joints=perimeter(o,P.lowerRing,P.floor,P.lowerRoof-.20,lod,6)+perimeter(o,P.upperRing,P.lowerRoof,P.concreteTop,lod,6)+perimeter(o,P.upperRing,P.concreteTop,P.mainRoof-.25,lod,3);
 closedPanel(o,P.lowerRing,1,.55,3.4,P.floor+.03,P.floor+4.5,lod,rgb('697e83'));
 closedPanel(o,P.lowerRing,2,.6,1.2,P.floor+.03,P.floor+2.7,lod,rgb('697e83'));
 closedPanel(o,P.upperRing,0,.5,6,P.operatingFloorY+2,P.operatingFloorY+7,lod,rgb('b4c1c5'));
 if(lod>=2)for(const y of P.floorMarkers){const ring=y<P.lowerRoof?P.lowerRing:P.upperRing;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];strut(o,'steel',[a[0],y,a[1]],[b[0],y,b[1]],.035,rgb('bac4c4'));}}
 if(lod===3){const x0=Math.min(...P.upperRing.map(p=>p[0]))+.15,x1=Math.max(...P.upperRing.map(p=>p[0]))-.15,z0=Math.min(...P.upperRing.map(p=>p[1])),z1=Math.max(...P.upperRing.map(p=>p[1]));for(let z=z0+3;z<z1-.5;z+=3)strut(o,'roof',[x0,P.mainRoof+.02,z],[x1,P.mainRoof+.02,z],.025,rgb('95a399'));}
 componentEvidence.push({lod,writtenLowerControls:P.lowerRing.length,writtenUpperControls:P.upperRing.length,wholeBody:true,allExteriorWalls:true,bothClosedRoofs:true,eastTerrace:true,foundation:true,closedEntries:2,closedUpperPanel:1,abovegroundOnly:true,undergroundEnlargementOmitted:true,internalContainmentOmitted:true,nativeUpperObservationNotGroundFootprint:true,facadePanelJoints:joints,notWholePlantProxy:true});
}
export const houseSkyline=(o,f)=>buildHouse(o,f,0),houseDistrict=(o,f)=>buildHouse(o,f,1),houseStreet=(o,f)=>buildHouse(o,f,2),houseCloseup=(o,f)=>buildHouse(o,f,3);
const root='content/worldgen/source/places/'+P.cell+'/'+P.model,camera=[100,70,120],look=[0,20,0];
export const houseModel={id:P.model,key:P.model,cell:P.cell,title:P.title,recipe:'house-model.mjs',surfaces,build:buildHouse,category:'landmark',quality:'medium-fi-exterior',reviewStatus:'review-in-qa.json',geographicStatus:'historical-proposal',orientationPolicy:'approximate-visualization',progressLedger:'qualla-002.PROGRESS.md',brief:'Whole Unit 5 aboveground reactor: operator-written 47m square lower body, 35.2m east-west by 47m north-south upper body, 46.05m abovegrade height. East lower terrace, concrete walls, closed roofs and entries. Native four-corner record registers upper roof only; lower outline is written dimensions. Finish, terrain tie and 2021 continuity estimated; appearance imagery unused.',appearance:{kind:'historical',representedDate:P.representedDate,validFrom:P.validFrom,validUntil:P.validUntil,currentWorldEligible:false},camera,lookAt:look,portableGroundY:-1.23,mediumFiContext:{scale:1,groundY:0,terrain:{descriptor:'terrain-review.terrain.json',heightmap:'terrain-review.height.png'}},embeddedCanonicalGraphs:['metal_corrugated','metal_painted','concrete_plain'],qaCameras:[{name:'whole-east-reactor-terrace-and-closed-entries',position:camera,lookAt:look},{name:'whole-west-reactor-and-rear',position:[-100,70,-120],lookAt:look}],qaLodCameras:['skyline','district','street','closeup'].map(reviewLod=>({name:'whole-Unit5-reactor-'+reviewLod,position:camera,lookAt:look,reviewLod})),runtimeLodOverlay:{module:root+'/models/house-model.mjs',level:'skyline',export:'houseSkyline',errorMeters:.2,surfaces,authoredLevels:{district:{export:'houseDistrict',errorMeters:.12,surfaces},street:{export:'houseStreet',errorMeters:.04,surfaces},closeup:{export:'houseCloseup',errorMeters:.001,surfaces}}},limitations:P.limitations,sourceLicense:'Original procedural geometry under repository license. Original Overture/OpenStreetMap roof coordinates ODbL-1.0 attributed; operator written numerical facts used for complete exterior. All source appearance imagery, report figures and plans unused. Fine finish, registration and nominal 2021 continuity estimated.'};
