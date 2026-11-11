/** Preston Mill as photographed in spring 2008, including the leaning kiln and wheel. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { beam, normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { B, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read=name=>JSON.parse(fs.readFileSync(new URL('../'+name+'.json',import.meta.url)));
const plan=read('plan-controls');
const frame=read('map-frame');
const [mill,kiln]=frame.geometry.polygons;
const {foundationBottom,millEaves,millRidge,kilnEaves,kilnPeak,wheelRadius,wheelAxleHeight,channelDepth}=plan.section;
const lade=read('native-map/mill-lade').local.slice(1,4);
const bank=(offset)=>lade.map(([x,z])=>[x,z+offset]);
const channel=[...bank(0.69),...bank(-0.76).reverse()];
const surfaces={
  stone:{slot:'wall',graph:'stone_drywall',roughness:0.95,metallic:0},
  tile:{slot:'roof',graph:'tile_flat',roughness:0.91,metallic:0},
  timber:{slot:'trim',graph:'wood_weatherboard',roughness:0.92,metallic:0},
  metal:{slot:'trim',graph:'metal_painted',roughness:0.78,metallic:0.22},
  inset:{slot:'window',localRef:'palette:#ffffff',roughness:0.54,metallic:0},
};
const tone=Object.fromEntries(Object.entries({
  stone:'a99582',basal:'8a816f',jamb:'c0ad96',tile:'a95d43',tileLight:'b76a48',
  timber:'a78d63',darkWood:'74664b',metal:'595a50',cap:'66716d',
  inset:'3d3c31',glass:'666c65',water:'3f564a',
}).map(([k,v])=>[k,rgb(v)]));

function face(out,slot,points,desired,color=tone[slot]){
  let n=normalFor(...points);
  if(n.reduce((s,v,i)=>s+v*desired[i],0)<0){
    points=[...points].reverse();
    n=normalFor(...points);
  }
  if(points.length===4) quad(out,slot,points,n,color);
  else out.addTriangle(slot,'palette:#ffffff',points,n,[[0,0],[1,0],[0,1]],color);
}
const at=([x,z],y)=>[x,y,z];
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function cap(out,slot,ring,y,color=tone[slot]){
  const raw=new MeshBufferBuilder();
  if(!raw.addCap(slot,'palette:#ffffff',ring,[],()=>y,[0,1,0],p=>p,color)) throw Error('Mill polygon cap');
  const mesh=raw.finalize();
  for(let i=0;i<mesh.indices.length;i+=3){
    const p=Array.from(mesh.indices.slice(i,i+3),j=>Array.from(mesh.positions.slice(j*3,j*3+3)));
    face(out,slot,p,[0,1,0],color);
  }
}
function edge(a,b){
  const span=Math.hypot(b[0]-a[0],b[1]-a[1]),x=(b[0]-a[0])/span,z=(b[1]-a[1])/span;
  return {span,normal:[z,0,-x],p:(u,y,d=0)=>[a[0]+x*u+z*d,y,a[1]+z*u-x*d]};
}
function panel(out,slot,f,a,b,y0,y1,d=0,color=tone[slot]){
  if(b-a<0.001||y1-y0<0.001)return;
  const {p,normal}=f;
  face(out,slot,[p(a,y0,d),p(b,y0,d),p(b,y1,d),p(a,y1,d)],normal,color);
}
function window(out,f,u,width,y0,y1,lod,door=false){
  const l=u-width/2,r=u+width/2;
  panel(out,'stone',f,l-0.16,r+0.16,y0-0.13,y1+0.14,0.035,tone.jamb);
  panel(out,door?'timber':'inset',f,l,r,y0,y1,0.054,door?tone.darkWood:tone.glass);
  if(lod>=1){
    panel(out,'inset',f,u-0.035,u+0.035,y0,y1,0.063,tone.inset);
    if(!door) panel(out,'inset',f,l,r,(y0+y1)/2-0.035,(y0+y1)/2+0.035,0.063,tone.inset);
  }
}

function millBuilding(out,lod){
  for(let i=0;i<mill.length;i++){
    const f=edge(mill[i],mill[(i+1)%mill.length]);
    panel(out,'stone',f,0,f.span,foundationBottom,0.42,0,tone.basal);
    panel(out,'stone',f,0,f.span,0.42,millEaves,0,tone.stone);
    if(i===1){
      window(out,f,2.3,0.8,0.57,2.54,lod,true);
      window(out,f,6.85,0.88,1.27,2.38,lod);
    }
    if(i===4) {
      window(out,f,3.42,0.95,1.15,2.3,lod);
      window(out,f,8.64,0.92,0.37,2.64,lod,true);
    }
    if(i===3) window(out,f,1.65,0.47,2.98,3.45,lod);
  }
  const endNorth=-2.71,endSouth=10.67,ridgeX=3.02;
  const north=[[-1.02,millEaves,-2.47],[6.5,millEaves,-2.47],[ridgeX,millRidge-0.15,-2.47]];
  const south=[[-0.62,millEaves,10.48],[6.8,millEaves,10.48],[ridgeX,millRidge-0.15,10.48]];
  face(out,'stone',north,[0,0,-1]);
  face(out,'stone',south,[0,0,1]);
  for(const sign of [-1,1]){
    const x=sign<0?-1.10:7.06;
    const ridge=[[ridgeX,millRidge,endNorth],[ridgeX,millRidge,endSouth]];
    const eave=[[x,millEaves-0.12,endNorth],[x,millEaves-0.12,endSouth]];
    face(out,'tile',[eave[0],eave[1],ridge[1],ridge[0]],[0,1,0],tone.tile);
    if(lod>=1){
      const bays=lod===1?8:lod===2?19:31;
      for(let i=0;i<bays;i++){
        const t=(i+0.5)/bays;
        const p=mix(eave[0],eave[1],t),q=mix(ridge[0],ridge[1],t);
        beam(out,'tile',[p[0],p[1]+0.042,p[2]],[q[0],q[1]+0.042,q[2]],0.062,0.077,i%3===0?tone.tileLight:tone.tile);
      }
    }
    for(const z of [1.2,6.15]){
      const t=0.49,w=0.85;
      const high=mix([x,millEaves-0.12,z],[ridgeX,millRidge,z],t+0.17);
      const low=mix([x,millEaves-0.12,z],[ridgeX,millRidge,z],t-0.16);
      face(out,'inset',[[low[0],low[1]+0.086,z-w/2],[low[0],low[1]+0.086,z+w/2],[high[0],high[1]+0.086,z+w/2],[high[0],high[1]+0.086,z-w/2]],[0,1,0],tone.glass);
    }
  }
  beam(out,'tile',[ridgeX,millRidge,endNorth],[ridgeX,millRidge,endSouth],0.22,0.18,tone.tileLight);
  B(out,'stone',5.1,5.88,1.42,1.15,1.68,1.07,tone.basal);
  B(out,'stone',5.1,7.55,1.42,1.27,0.16,1.18,tone.jamb);
}

function roundKiln(out,lod){
  const bottom=[-3.49,-6.71],top=[-3.24,-6.91],peak=[-2.57,-7.17];
  const sides=[12,20,28,36][lod];
  const point=(c,r,ry,y,i)=>[c[0]+r*Math.cos(i*2*Math.PI/sides),y,c[1]+ry*Math.sin(i*2*Math.PI/sides)];
  for(let i=0;i<sides;i++){
    const n=[Math.cos((i+0.5)*2*Math.PI/sides),0,Math.sin((i+0.5)*2*Math.PI/sides)];
    const a=point(bottom,3.22,3.52,foundationBottom,i),b=point(bottom,3.22,3.52,foundationBottom,i+1);
    const c=point(top,3.17,3.4,kilnEaves,i+1),d=point(top,3.17,3.4,kilnEaves,i);
    face(out,'stone',[a,b,c,d],n,tone.stone);
    const e=point(top,3.33,3.53,kilnEaves-0.08,i),f=point(top,3.33,3.53,kilnEaves-0.08,i+1);
    const g=point(peak,0.64,0.66,kilnPeak-1.14,i+1),h=point(peak,0.64,0.66,kilnPeak-1.14,i);
    face(out,'tile',[e,f,g,h],[0,1,0],i%3===1?tone.tileLight:tone.tile);
    face(out,'metal',[h,g,[peak[0],kilnPeak,peak[1]]],[0,1,0],tone.cap);
    if(lod>=2) beam(out,'tile',[e[0],e[1]+0.065,e[2]],[h[0],h[1]+0.06,h[2]],0.07,0.078,tone.tileLight);
  }
  beam(out,'metal',[peak[0]-0.37,kilnPeak,peak[1]],[peak[0]+0.25,kilnPeak,peak[1]],0.045,0.064,tone.cap);
  for(const i of [6,8,10]){
    const outer=kiln[i];
    const inner=mix(bottom,outer,0.59);
    const dx=outer[0]-inner[0],dz=outer[1]-inner[1],n=Math.hypot(dx,dz);
    const q=[-dz/n*0.42,dx/n*0.42];
    const a=outer.map((v,j)=>v+q[j]),b=outer.map((v,j)=>v-q[j]);
    const c=inner.map((v,j)=>v-q[j]),d=inner.map((v,j)=>v+q[j]);
    face(out,'stone',[at(a,0.15),at(b,0.15),at(b,0.56),at(a,0.56)],[dx,0,dz],tone.basal);
    face(out,'stone',[at(a,0.56),at(b,0.56),at(c,2.83),at(d,2.83)],[0,1,0],tone.basal);
    face(out,'stone',[at(a,0.15),at(a,0.56),at(d,2.83),at(d,0.15)],[q[0],0,q[1]],tone.stone);
    face(out,'stone',[at(b,0.15),at(b,0.56),at(c,2.83),at(c,0.15)],[-q[0],0,-q[1]],tone.stone);
  }
  const shed=[[-0.22,-8.61],[3.65,-8.4],[3.82,-5.25],[0.0,-5.4]];
  for(let i=0;i<4;i++){
    const f=edge(shed[i],shed[(i+1)%shed.length]);
    panel(out,'stone',f,0,f.span,foundationBottom,2.39,0,tone.basal);
    if(i===1)window(out,f,f.span*0.57,0.78,0.2,1.96,lod,true);
  }
  face(out,'tile',[at(shed[0],3.01),at(shed[1],2.37),at(shed[2],2.37),at(shed[3],3.01)],[0,1,0],tone.tile);
}

function linkedPassage(out,lod){
  const x=0.61,z=-3.05;
  B(out,'stone',x,-0.02,z,2.95,0.63,2.85,tone.basal);
  B(out,'timber',x,0.61,z,2.7,2.74,2.73,tone.darkWood);
  const a=[x-1.56,3.24,z-1.56],b=[x-1.56,3.24,z+1.56];
  const c=[x+1.56,3.24,z-1.56],d=[x+1.56,3.24,z+1.56];
  const p=[x,4.21,z-1.56],q=[x,4.21,z+1.56];
  face(out,'tile',[a,b,q,p],[0,1,0],tone.tileLight);
  face(out,'tile',[p,q,d,c],[0,1,0],tone.tile);
  face(out,'timber',[a,c,p],[0,0,-1],tone.darkWood);
  face(out,'timber',[b,d,q],[0,0,1],tone.darkWood);
  if(lod>=1){
    for(const u of [-0.83,-0.31,0.21,0.73]) B(out,'timber',x+u,0.63,z+1.43,0.08,2.58,0.12,tone.timber);
  }
}

function millLade(out,lod){
  const north=bank(-0.76),south=bank(0.69),waterY=-0.38;
  for(let i=0;i+1<lade.length;i++){
    const j=i+1;
    face(out,'inset',[at(north[i],waterY),at(north[j],waterY),at(south[j],waterY),at(south[i],waterY)],[0,1,0],tone.water);
    for(const [ring,sign] of [[north,1],[south,-1]]) {
      face(out,'stone',[at(ring[i],channelDepth),at(ring[j],channelDepth),at(ring[j],0.16),at(ring[i],0.16)],[0,0,sign],tone.basal);
    }
  }
  for(const z of [11.0,11.67]) B(out,'timber',8.07,-0.29,z,0.15,0.95,0.13,tone.darkWood);
  B(out,'timber',8.07,0.56,11.35,0.19,0.14,0.9,tone.timber);
  if(lod>=1) for(let i=0;i<4;i++) B(out,'timber',8.07,-0.31,11.07+i*0.18,0.085,0.53,0.17,tone.timber);
}

function waterwheel(out,lod){
  const x=4.54,z=11.36,r=wheelRadius,y=wheelAxleHeight;
  const segments=[12,18,24,28][lod],width=0.95;
  const pos=(t,rad,offset)=>[x+rad*Math.cos(t),y+rad*Math.sin(t),z+offset];
  for(let i=0;i<segments;i++){
    const a=2*Math.PI*i/segments,b=2*Math.PI*(i+1)/segments;
    for(const side of [-1,1]){
      const d=side*width/2;
      face(out,'metal',[pos(a,r,d),pos(b,r,d),pos(b,r-0.125,d),pos(a,r-0.125,d)],[0,0,side],tone.metal);
      face(out,'metal',[pos(a,r,d),pos(b,r,d),pos(b,r,d-side*0.071),pos(a,r,d-side*0.071)],
        [Math.cos((a+b)/2),Math.sin((a+b)/2),0],tone.metal);
    }
    const paddle=(a+b)/2,inner=r-0.36;
    face(out,'timber',[pos(paddle,inner,-width/2),pos(paddle,r-0.025,-width/2),pos(paddle,r-0.025,width/2),pos(paddle,inner,width/2)],
      [-Math.sin(paddle),Math.cos(paddle),0],tone.timber);
    if(lod>=1) face(out,'timber',[pos(paddle+0.04,inner,width/2),pos(paddle+0.04,r-0.025,width/2),pos(paddle+0.04,r-0.025,-width/2),pos(paddle+0.04,inner,-width/2)],
      [Math.sin(paddle),-Math.cos(paddle),0],tone.timber);
  }
  const spokes=lod?8:6;
  for(let i=0;i<spokes;i++){
    const a=i*2*Math.PI/spokes;
    for(const d of [-width/2,width/2]) beam(out,'metal',pos(a,0.16,d),pos(a,r-0.12,d),0.078,0.079,tone.metal);
  }
  beam(out,'metal',[x,y,10.29],[x,y,12.03],0.27,0.25,tone.metal);
  B(out,'stone',x,-0.57,12.17,0.57,1.54,0.48,tone.basal);
}

function build(out,_frame,lod=3){
  millBuilding(out,lod);
  roundKiln(out,lod);
  linkedPassage(out,lod);
  millLade(out,lod);
  waterwheel(out,lod);
}
export const millSkyline=(out,frame)=>build(out,frame,0);
export const millDistrict=(out,frame)=>build(out,frame,1);
export const millStreet=(out,frame)=>build(out,frame,2);
export const millCloseup=(out,frame)=>build(out,frame,3);

const recipe='mill-model.mjs';
const camera=[19,13,25],lookAt=[0,3.1,0];
export const millModel={
  id:plan.model,key:plan.model,title:plan.title,cell:plan.cell,wikidataId:plan.wikidataId,
  recipe,surfaces,build,quality:'medium-fi-exterior',reviewStatus:'review-in-qa.json',
  geographicStatus:'historical-proposal',orientationPolicy:'approximate-visualization',progressLedger:'qualla-003.PROGRESS.md',
  brief:'Preston Mill in East Linton with its rubble watermill, leaning pantile kiln and undershot wheel beside the mill lade.',
  appearance:{kind:'historical',representedDate:plan.representedDate,validFrom:plan.validFrom,validUntil:plan.validUntil,currentWorldEligible:false},
  camera,lookAt,portableGroundY:-0.93,
  groundCutout:{outline:channel,basis:'Open only the modeled segment of the mapped mill lade below the wheel and sluice. The original terrain samples remain unchanged.'},
  buildingCutout:{outline:mill,outlines:[mill,kiln],minimumCoverage:0.96,basis:'Suppress the two exact generic footprints of the attached mill and kiln when the authored model is placed.'},
  mediumFiContext:{scale:0.78,groundY:-0.1,terrain:{descriptor:'terrain-review.terrain.json',heightmap:'terrain-review.height.png'}},
  embeddedCanonicalGraphs:['stone_drywall','tile_flat','wood_weatherboard','metal_painted'],
  qaCameras:[
    {name:'leaning-kiln-and-linked-mill',position:[-17,6.5,9],lookAt:[-1,3.5,-2]},
    {name:'undershot-wheel-and-lade',position:[11,3.65,19],lookAt:[4.55,1.45,10.8]},
    {name:'pantiles-and-kiln-cap',position:[6,10,-14],lookAt:[-2.1,5.3,-6.1]},
  ],
  qaLodCameras:['skyline','district','street','closeup'].map(reviewLod=>({name:'whole-preston-mill-'+reviewLod,position:camera,lookAt,reviewLod})),
  runtimeLodOverlay:{
    module:'content/worldgen/source/places/'+plan.cell+'/'+plan.model+'/models/'+recipe,
    level:'skyline',export:'millSkyline',errorMeters:0.18,surfaces,
    authoredLevels:Object.fromEntries([
      ['district','millDistrict',0.11],['street','millStreet',0.044],['closeup','millCloseup',0.016],
    ].map(([name,exportName,errorMeters])=>[name,{export:exportName,errorMeters,surfaces}])),
  },
  limitations:plan.limitations,
  sourceLicense:'Original deterministic geometry under the repository license. Renata released the cited exact photographic originals into the public domain. OpenStreetMap contributors supply the mapped controls under ODbL.',
};
