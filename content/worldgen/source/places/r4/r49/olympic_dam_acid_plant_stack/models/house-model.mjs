/** Original whole numerical stack, with unobserved shell/support details explicitly estimated. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {beam,normalFor} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {rgb} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P=JSON.parse(fs.readFileSync(new URL('../plan-controls.json',import.meta.url)));
export const surfaces={wall:{slot:'wall',graph:'metal_painted',roughness:.84,metallic:.2},trim:{slot:'trim',graph:'metal_stainless_beadblasted',roughness:.72,metallic:.65},foundation:{slot:'foundation',graph:'concrete_plain',roughness:.99,metallic:0},dark:{slot:'door',graph:'metal_painted',roughness:.94,metallic:.1}};
const colors={wall:rgb('c5ccc8'),trim:rgb('8d9c99'),foundation:rgb('a9a79a'),dark:rgb('27312f')};export const componentEvidence=[];
const point=(r,a,y)=>[r*Math.cos(a),y,r*Math.sin(a)];
function face(o,k,p,n){let v=normalFor(...p);if(v.reduce((s,a,i)=>s+a*n[i],0)<0){p=[...p].reverse();v=normalFor(...p)}o.addConvexPolygon(k,'palette:#ffffff',p,v,q=>[q[0],q[1]],colors[k]);}
function side(o,k,r0,r1,y0,y1,n,inward=false){for(let i=0;i<n;i++){const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n,s=inward?-1:1;face(o,k,[point(r0,a,y0),point(r0,b,y0),point(r1,b,y1),point(r1,a,y1)],[s*Math.cos((a+b)/2),s*(r0-r1)/(y1-y0),s*Math.sin((a+b)/2)]);}}
function cap(o,k,r,y,n,up){face(o,k,Array.from({length:n},(_,i)=>point(r,i*2*Math.PI/n,y)),[0,up,0]);}
function annulus(o,k,ro,ri,y,n,up=1){for(let i=0;i<n;i++){const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n;face(o,k,[point(ro,a,y),point(ro,b,y),point(ri,b,y),point(ri,a,y)],[0,up,0]);}}
const radius=y=>P.radiusBase+(P.radiusTop-P.radiusBase)*(y-P.floor)/P.civilHeight;
function rail(o,r,y,n,w){for(let i=0;i<n;i++)beam(o,'trim',point(r,i*2*Math.PI/n,y),point(r,(i+1)*2*Math.PI/n,y),w,w,colors.trim);}
export function buildHouse(o,_frame,lod=3){componentEvidence.length=0;const n=[12,20,32,48][lod],top=P.shellTop,inner=P.innerTipDiameter/2,py=top-P.platformBelowTop,outer=radius(py)+P.platformProjection;
 side(o,'foundation',P.foundationRadius,P.foundationRadius,P.foundationBottom,P.foundationTop,n);cap(o,'foundation',P.foundationRadius,P.foundationBottom,n,-1);cap(o,'foundation',P.foundationRadius,P.foundationTop,n,1);
 side(o,'wall',P.radiusBase,P.radiusTop,P.floor,top,n);cap(o,'wall',P.radiusBase,P.floor,n,-1);annulus(o,'trim',P.radiusTop,inner,top,n);side(o,'dark',inner,inner,top-P.innerDepth,top,n,true);cap(o,'dark',inner,top-P.innerDepth,n,1);
 annulus(o,'trim',outer,radius(py)-.02,py,n);annulus(o,'trim',outer,radius(py)-.02,py-.08,n,-1);side(o,'trim',outer,outer,py-.08,py,n);
 // Estimated closed inspection cover, kept separate from the numerically specified bore.
 const z=radius(P.floor+.8)+.02;face(o,'dark',[[-.25,P.floor+.45,z],[.25,P.floor+.45,z],[.25,P.floor+1.15,z],[-.25,P.floor+1.15,z]],[0,0,1]);
 if(lod>0){const posts=[0,8,12,16][lod];for(let i=0;i<posts;i++){const a=i*2*Math.PI/posts;beam(o,'trim',point(outer-.08,a,py),point(outer-.08,a,py+1.05),.055,.055,colors.trim);}rail(o,outer-.08,py+1.05,n,.055);if(lod>1)rail(o,outer-.08,py+.55,n,.04);
  const y0=P.floor+.3,y1=py+.4,at=(x,y)=>[x,y,-radius(y)-.25];for(const x of[-.25,.25])beam(o,'trim',at(x,y0),at(x,y1),.055,.055,colors.trim);if(lod>1){const step=lod===2?.6:.3;for(let y=y0;y<y1;y+=step)beam(o,'trim',at(-.25,y),at(.25,y),.035,.035,colors.trim);}
  for(let y=P.floor+10;y<top-2;y+=10){const r=radius(y);annulus(o,'trim',r+.025,r-.015,y,n);if(lod>1)side(o,'trim',r+.025,r+.025,y-.04,y+.04,n);}
 }
 componentEvidence.push({lod,wholeStack:true,civilHeightMeters:P.civilHeight,internalTipDiameterMeters:P.innerTipDiameter,foundation:true,closedInspectionCover:true,openBore:true,topMaintenanceRing:true,ladder:lod>0,notWholeMineProxy:true,sourceRecordIds:P.sourceRecordIds});
}
export const houseSkyline=(o,f)=>buildHouse(o,f,0),houseDistrict=(o,f)=>buildHouse(o,f,1),houseStreet=(o,f)=>buildHouse(o,f,2),houseCloseup=(o,f)=>buildHouse(o,f,3);
const root='content/worldgen/source/places/'+P.cell+'/'+P.model,camera=[P.civilHeight*1.2,P.civilHeight*.8,P.civilHeight*1.3],look=[0,P.civilHeight*.5,0];
export const houseModel={id:P.model,key:P.model,cell:P.cell,title:P.title,recipe:'house-model.mjs',surfaces,build:buildHouse,category:'landmark',quality:'medium-fi-exterior',reviewStatus:'review-in-qa.json',geographicStatus:'historical-proposal',orientationPolicy:'approximate-visualization',progressLedger:'qualla-002.PROGRESS.md',brief:P.limitations.join(' '),appearance:{kind:'historical',representedDate:P.representedDate,validFrom:P.validFrom,validUntil:P.validUntil,currentWorldEligible:false},camera,lookAt:look,portableGroundY:P.foundationBottom-.03,mediumFiContext:{scale:1,groundY:0,terrain:{descriptor:'terrain-review.terrain.json',heightmap:'terrain-review.height.png'}},embeddedCanonicalGraphs:['metal_painted','metal_stainless_beadblasted','concrete_plain'],qaCameras:[{name:'upper-open-outlet-and-maintenance-ring',position:[9,P.shellTop+5,10],lookAt:[0,P.shellTop-1,0]},{name:'lower-complete-stack-base-and-access-cover',position:[12,6,14],lookAt:[0,3,0]}],qaLodCameras:['skyline','district','street','closeup'].map(reviewLod=>({name:'whole-exhaust-stack-'+reviewLod,position:camera,lookAt:look,reviewLod})),runtimeLodOverlay:{module:root+'/models/house-model.mjs',level:'skyline',export:'houseSkyline',errorMeters:.3,surfaces,authoredLevels:{district:{export:'houseDistrict',errorMeters:.15,surfaces},street:{export:'houseStreet',errorMeters:.05,surfaces},closeup:{export:'houseCloseup',errorMeters:.01,surfaces}}},limitations:P.limitations,sourceLicense:'Original deterministic geometry under repository license; operator1997written/numericalfacts and original numericalOSMcontext credited. All imagery/graphics unused. Exteriorsection/material/support/access/grade and source-datum interpretation explicitly estimated.'};
