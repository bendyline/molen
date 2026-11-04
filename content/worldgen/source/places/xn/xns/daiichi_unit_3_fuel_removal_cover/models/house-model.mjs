/** Whole Unit 3 fuel-removal dome cover and portal frame, original written/numerical controls. */
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



const domeY=z=>P.mainRoof-P.roofRadius+Math.sqrt(P.roofRadius*P.roofRadius-z*z);
export function buildHouse(o,_f,lod=3){
 componentEvidence.length=0;
 const n=[8,12,20,28][lod],zs=Array.from({length:n+1},(_,i)=>-P.halfWidth+2*P.halfWidth*i/n),profile=[[-P.halfWidth,P.workFloor],[P.halfWidth,P.workFloor],...zs.slice().reverse().map(z=>[z,domeY(z)])];
 prism(o,'steel',P.coverRing,P.workFloor-P.roofThickness,P.workFloor,rgb('9ca8a7'));
 for(const sign of[-1,1]){
  const z=sign*P.halfWidth;face(o,'upper',[[-P.halfLength,P.workFloor,z],[P.halfLength,P.workFloor,z],[P.halfLength,P.eave,z],[-P.halfLength,P.eave,z]],[0,0,sign],rgb('c6cdd0'));
  const x=sign*P.halfLength;face(o,'upper',profile.map(([z,y])=>[x,y,z]),[sign,0,0],rgb('c6cdd0'));
 }
 for(let i=0;i<n;i++){const a=zs[i],b=zs[i+1];face(o,'roof',[[-P.halfLength,domeY(a),a],[P.halfLength,domeY(a),a],[P.halfLength,domeY(b),b],[-P.halfLength,domeY(b),b]],[0,1,0],rgb('cbd2d2'));}
 let braceCount=0;
 for(const sx of[-1,1])for(const sz of[-1,1]){
  const x=sx*P.towerX,z=sz*P.towerZ,base=sx<0?P.westBearingTop:P.eastBearingTop,bottom=sx<0?P.foundationBottom:P.eastBearingBottom;
  box(o,'foundation',x,z,2.8,2.8,bottom,base);
  if(lod===0){box(o,'steel',x,z,.75,.75,base,P.workFloor-P.girderDepth);continue;}
  const h=P.towerHalfSection,points=[[-h,-h],[h,-h],[h,h],[-h,h]].map(([a,b])=>[x+a,z+b]),top=P.workFloor-P.girderDepth,N=Math.ceil((top-base)/(lod===1?7:4));
  for(const[a,b]of points)strut(o,'steel',[a,base,b],[a,top,b],P.towerChord,rgb('a6b4b7'));
  for(let j=0;j<N;j++){const y0=base+(top-base)*j/N,y1=base+(top-base)*(j+1)/N;for(let k=0;k<(lod===1?2:4);k++){const a=points[k],b=points[(k+1)%4];strut(o,'steel',[a[0],y0,a[1]],[b[0],y1,b[1]],.13,rgb('91a4ac'));braceCount++;if(lod===3){strut(o,'steel',[b[0],y0,b[1]],[a[0],y1,a[1]],.10,rgb('91a4ac'));braceCount++;}strut(o,'steel',[a[0],y1,a[1]],[b[0],y1,b[1]],.13);}}
 }
 for(const sz of[-1,1]){const z=sz*P.towerZ;for(const y of[P.workFloor-P.girderDepth,P.workFloor-.18])strut(o,'steel',[-P.towerX,y,z],[P.towerX,y,z],.30,rgb('a2b0b4'));if(lod>=1){const N=lod===1?8:14;for(let i=0;i<N;i++){const x=-P.towerX+2*P.towerX*i/N,xx=-P.towerX+2*P.towerX*(i+1)/N;strut(o,'steel',[x,P.workFloor-P.girderDepth,z],[xx,P.workFloor-.18,z],.16);braceCount++;}}}
 for(const sx of[-1,1])strut(o,'steel',[sx*P.towerX,P.workFloor-.3,-P.towerZ],[sx*P.towerX,P.workFloor-.3,P.towerZ],.35,rgb('a2b0b4'));
 if(lod>=1){for(const sign of[-1,1]){const z=sign*(P.halfWidth+.045);strut(o,'steel',[-P.halfLength,P.workFloor,z],[P.halfLength,P.workFloor,z],.10);strut(o,'steel',[-P.halfLength,P.eave,z],[P.halfLength,P.eave,z],.10);}}
 if(lod>=2){for(let x=-P.halfLength+4;x<P.halfLength-.2;x+=4)for(const sign of[-1,1])strut(o,'steel',[x,P.workFloor+.08,sign*(P.halfWidth+.05)],[x,P.eave,sign*(P.halfWidth+.05)],.035,rgb('a0afb6'));
 for(let j=1;j<8;j++){const x=-P.halfLength+2*P.halfLength*j/8;for(let i=0;i<n;i++)strut(o,'roof',[x,domeY(zs[i])+.035,zs[i]],[x,domeY(zs[i+1])+.035,zs[i+1]],lod===3?.055:.035,rgb('a4b4bc'));}}
 componentEvidence.push({lod,wholeIndependentCover:true,closedBarrelRoof:true,allUpperExteriorWallsAndEndCaps:true,closedWorkFloor:true,portalTrussFrame:true,westTowers:2,eastTowers:2,concreteBearingBlocks:4,elevatedEasternBearings:true,nativeEnvelopeIsContextOnly:true,underlyingReactorOmitted:true,notWholePlantProxy:true,curveSegments:n,braceCount});
}
export const houseSkyline=(o,f)=>buildHouse(o,f,0),houseDistrict=(o,f)=>buildHouse(o,f,1),houseStreet=(o,f)=>buildHouse(o,f,2),houseCloseup=(o,f)=>buildHouse(o,f,3);
const root='content/worldgen/source/places/'+P.cell+'/'+P.model,camera=[105,65,100],look=[0,29,0];
export const houseModel={id:P.model,key:P.model,cell:P.cell,title:P.title,recipe:'house-model.mjs',surfaces,build:buildHouse,category:'landmark',quality:'medium-fi-exterior',reviewStatus:'review-in-qa.json',geographicStatus:'historical-proposal',orientationPolicy:'approximate-visualization',progressLedger:'qualla-002.PROGRESS.md',brief:'Whole independent Unit 3 fuel-removal steel dome cover and portal-truss frame. Original written57mEW/22.8mNS/53.5m crown,47.6m eaves,36m workfloor. Four bearing blocks at estimated west1F/east3F support levels; underlying damaged reactor remains separate. Circular roof interpolation, portal details/finish and nominal2019continuity estimated. All appearance imagery unused.',appearance:{kind:'historical',representedDate:P.representedDate,validFrom:P.validFrom,validUntil:P.validUntil,currentWorldEligible:false},camera,lookAt:look,portableGroundY:-1.23,mediumFiContext:{scale:1,groundY:0,terrain:{descriptor:'terrain-review.terrain.json',heightmap:'terrain-review.height.png'}},embeddedCanonicalGraphs:['metal_corrugated','metal_painted','concrete_plain'],qaCameras:[{name:'whole-east-dome-and-elevated-bearing-frame',position:camera,lookAt:look},{name:'whole-west-dome-and-low-bearing-frame',position:[-105,65,-100],lookAt:look}],qaLodCameras:['skyline','district','street','closeup'].map(reviewLod=>({name:'whole-Unit3-dome-cover-'+reviewLod,position:camera,lookAt:look,reviewLod})),runtimeLodOverlay:{module:root+'/models/house-model.mjs',level:'skyline',export:'houseSkyline',errorMeters:.25,surfaces,authoredLevels:{district:{export:'houseDistrict',errorMeters:.15,surfaces},street:{export:'houseStreet',errorMeters:.05,surfaces},closeup:{export:'houseCloseup',errorMeters:.001,surfaces}}},limitations:P.limitations,sourceLicense:'Original procedural geometry under repository license. Written numerical operator structural facts from original NRA public archive; Overture/OSM approximate envelope context ODbL attributed. All appearance imagery, report figures/plans/photos and map/satellite pixels unused. Underlying reactor omitted; roof profile/portal details/finish/registration/2019continuity estimated.'};
