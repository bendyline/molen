/** Hereford Inlet's connected keeper house and lantern tower in July 2023. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { beam, normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { B, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read=name=>JSON.parse(fs.readFileSync(new URL('../'+name+'.json',import.meta.url)));
const plan=read('plan-controls');
const frame=read('map-frame');
const [house,tower]=frame.geometry.polygons;
const {foundationBottom,deck,mainEaves,mainRidge,towerTop}=plan.section;
const surfaces={
  siding:{slot:'wall',graph:'wood_weatherboard',roughness:0.9,metallic:0},
  brick:{slot:'foundation',graph:'brick',roughness:0.92,metallic:0},
  roof:{slot:'roof',graph:'slate',roughness:0.89,metallic:0},
  trim:{slot:'trim',graph:'metal_painted',roughness:0.82,metallic:0},
  window:{slot:'window',localRef:'palette:#ffffff',roughness:0.41,metallic:0.03},
};
const tone=Object.fromEntries(Object.entries({
  siding:'cabc7e',pale:'e9e3d0',shade:'b8b193',roof:'77736c',roofEdge:'686660',
  brick:'8d564e',tread:'828680',window:'565b51',dark:'3e413b',glass:'627070',
}).map(([k,v])=>[k,rgb(v)]));

function face(out,slot,p,wanted,color=tone[slot]){
  let n=normalFor(...p);
  if(n.reduce((s,v,i)=>s+v*wanted[i],0)<0){
    p=[...p].reverse();
    n=normalFor(...p);
  }
  if(p.length===4)quad(out,slot,p,n,color);
  else out.addTriangle(slot,'palette:#ffffff',p,n,[[0,0],[1,0],[0,1]],color);
}

function cap(out,slot,ring,y,color=tone[slot]){
  const b=new MeshBufferBuilder();
  if(!b.addCap(slot,'palette:#ffffff',ring,[],()=>y,[0,1,0],p=>p,color)) throw Error('Lighthouse floor cap');
  const mesh=b.finalize();
  for(let i=0;i<mesh.indices.length;i+=3){
    const p=Array.from(mesh.indices.slice(i,i+3),j=>Array.from(mesh.positions.slice(j*3,j*3+3)));
    face(out,slot,p,[0,1,0],color);
  }
}

const at=([x,z],y)=>[x,y,z];
const rect=(x0,x1,z0,z1)=>[[x0,z0],[x0,z1],[x1,z1],[x1,z0]];
function edge([x,z],b){
  const span=Math.hypot(b[0]-x,b[1]-z),u=(b[0]-x)/span,v=(b[1]-z)/span;
  return {span,normal:[-v,0,u],p:(s,y,d=0)=>[x+u*s-v*d,y,z+v*s+u*d]};
}
const sides=ring=>ring.map((p,i)=>edge(p,ring[(i+1)%ring.length]));
function panel(out,slot,f,a,b,y0,y1,d=0,color=tone[slot]){
  if(b-a<0.001||y1-y0<0.001)return;
  const {p,normal}=f;
  face(out,slot,[p(a,y0,d),p(b,y0,d),p(b,y1,d),p(a,y1,d)],normal,color);
}
function frameWindow(out,f,x,y,w,h,lod,door=false){
  panel(out,'trim',f,x-w/2-0.09,x+w/2+0.09,y-0.07,y+h+0.08,0.025,tone.pale);
  panel(out,'window',f,x-w/2,x+w/2,y,y+h,0.043,door?tone.dark:tone.window);
  if(lod){
    panel(out,'trim',f,x-w/2,x+w/2,y+h*0.55-0.025,y+h*0.55+0.025,0.054,tone.pale);
    if(!door)panel(out,'trim',f,x-0.022,x+0.022,y,y+h,0.055,tone.pale);
  }
}

function wallVolume(out,ring,base,eaves,windows,lod){
  for(const [i,f] of sides(ring).entries()){
    panel(out,'siding',f,0,f.span,base,eaves);
    panel(out,'trim',f,0,f.span,base,base+0.16,0.038,tone.pale);
    panel(out,'trim',f,0,f.span,eaves-0.12,eaves,0.042,tone.shade);
    for(const [t,y,w,h,door] of windows[i]??[])frameWindow(out,f,f.span*t,y,w,h,lod,door);
    if(lod>=2) for(const a of [0,f.span-0.14]) panel(out,'trim',f,a,a+0.14,base,eaves,0.05,tone.pale);
  }
}

function gableRoof(out,[x0,x1,z0,z1],eave,ridge,lod,accent=false){
  const mid=(x0+x1)/2,hang=0.28;
  for(const x of [x0-hang,x1+hang]){
    face(out,'roof',[[x,eave,z0-hang],[x,eave,z1+hang],[mid,ridge,z1+hang],[mid,ridge,z0-hang]],[0,1,0],tone.roof);
    if(lod>=1) beam(out,'trim',[x,eave-0.035,z0-hang],[x,eave-0.035,z1+hang],0.11,0.13,tone.shade);
  }
  for(const [z,sign] of [[z0,-1],[z1,1]]){
    face(out,'siding',[[x0,eave,z],[x1,eave,z],[mid,ridge,z]],[0,0,sign],tone.siding);
    const a=[x0-hang,eave,z+sign*hang],b=[mid,ridge,z+sign*hang],c=[x1+hang,eave,z+sign*hang];
    beam(out,'trim',a,b,0.105,0.12,tone.pale);
    beam(out,'trim',b,c,0.105,0.12,tone.pale);
    if(accent&&lod){
      const inner=[mid,eave+0.45,z+sign*0.045];
      beam(out,'trim',inner,[mid,ridge-0.3,z+sign*0.045],0.10,0.075,tone.shade);
      if(lod>=2) for(const u of [-1,1])
        beam(out,'trim',[mid+u*(x1-x0)*0.25,eave+0.04,z+sign*0.048],inner,0.095,0.075,tone.shade);
    }
  }
}

function chimney(out,x,z,y,h){
  B(out,'brick',x,y,z,0.65,h,0.66,tone.brick);
  B(out,'brick',x,y+h-0.19,z,0.77,0.15,0.78,tone.brick);
  B(out,'roof',x,y+h-0.035,z,0.71,0.08,0.72,tone.roofEdge);
}

function residence(out,lod){
  for(const f of sides(house)) panel(out,'brick',f,0,f.span,foundationBottom,deck,0,tone.brick);
  cap(out,'trim',house,deck-0.012,tone.tread);
  const main=[-5,4.81,-6.03,5.63];
  const windows=[
    [[0.22,1.77,0.78,1.67],[0.66,1.76,0.84,1.68],[0.31,4.36,0.78,1.38],[0.7,4.36,0.78,1.38]],
    [[0.23,1.38,0.81,1.88,true],[0.61,1.65,0.85,1.67],[0.64,4.28,0.85,1.47]],
    [[0.25,1.72,0.78,1.55],[0.69,1.74,0.83,1.59],[0.27,4.34,0.8,1.45],[0.69,4.32,0.8,1.47]],
    [[0.27,1.66,0.86,1.58],[0.72,1.61,0.8,1.7],[0.27,4.33,0.8,1.46],[0.73,4.33,0.8,1.46]],
  ];
  wallVolume(out,rect(...main),deck,mainEaves,windows,lod);
  gableRoof(out,main,mainEaves,mainRidge,lod,true);
  const wing=[-6.75,-2.22,-0.06,6.78];
  wallVolume(out,rect(...wing),deck,3.98,[
    [[0.47,1.71,0.8,1.6]],[[0.45,1.25,0.86,2.0,true]],[],[[0.44,1.52,0.77,1.62]],
  ],lod);
  gableRoof(out,wing,3.98,5.62,lod,true);
  chimney(out,-5.21,4.62,4.49,2.62);
  chimney(out,3.08,-4.95,6.36,2.45);
}

function rail(out,a,b,lod){
  const count=[2,4,5,7][lod];
  beam(out,'trim',a,b,0.13,0.15,tone.pale);
  const drop=v=>[v[0],v[1]-0.54,v[2]];
  beam(out,'trim',drop(a),drop(b),0.073,0.11,tone.pale);
  for(let i=0;i<=count;i++){
    const t=i/count,p=a.map((v,k)=>v+(b[k]-v)*t);
    beam(out,'trim',drop(p),p,i===0||i===count?0.108:0.053,0.084,tone.pale);
    if(lod>=2&&i<count){
      const q=p.map((v,k)=>v+(b[k]-a[k])/(2*count));
      const c=[q[0],q[1]-0.27,q[2]];
      beam(out,'trim',[c[0],c[1]-0.11,c[2]],[c[0],c[1]+0.11,c[2]],0.073,0.069,tone.shade);
    }
  }
}

function stairs(out,x,z,sign,w,lod){
  const length=2.16,count=lod===0?3:7;
  for(let i=0;i<count;i++){
    const fraction=(i+1)/count;
    const run=length*(1-i/count),y=deck*fraction;
    B(out,'trim',x,-0.16,z+sign*run/2,w,y+0.16,run,tone.tread);
  }
  if(lod>=1) for(const dx of [-w/2,w/2])
    rail(out,[x+dx,deck+0.79,z],[x+dx,0.78,z+sign*length],lod);
}

function porch(out,[x0,x1,z0,z1],sign,lod){
  const front=sign>0?z1:z0,back=sign>0?z0:z1;
  const top=3.73,outer=top-0.31;
  face(out,'roof',[[x0-0.14,outer,front+sign*0.19],[x1+0.14,outer,front+sign*0.19],
    [x1+0.14,top,back-sign*0.09],[x0-0.14,top,back-sign*0.09]],[0,1,0],tone.roof);
  const width=x1-x0,bays=3,stairX=sign>0?x0+width*0.5:x0+width*0.76;
  const pathW=1.29;
  for(let i=0;i<=bays;i++){
    const x=x0+width*i/bays;
    B(out,'trim',x,deck,front,0.138,outer-deck,0.135,tone.pale);
    if(lod){
      B(out,'trim',x,outer-0.44,front,0.19,0.08,0.19,tone.pale);
      beam(out,'trim',[x,outer-0.34,front],[x+(i===bays?-0.36:0.36),outer,front],0.071,0.076,tone.pale);
    }
  }
  for(const [a,b] of [[x0,stairX-pathW/2],[stairX+pathW/2,x1]])
    rail(out,[a,deck+0.8,front],[b,deck+0.8,front],lod);
  stairs(out,stairX,front,sign,pathW,lod);
}

function lightTower(out,lod){
  const ring=[...tower].reverse();
  const center=ring.reduce(([x,z],[u,v])=>[x+u/ring.length,z+v/ring.length],[0,0]);
  const scaled=r=>ring.map(([x,z])=>[center[0]+(x-center[0])*r,center[1]+(z-center[1])*r]);
  wallVolume(out,ring,5.51,13.01,Array.from({length:4},()=>[
    [0.5,9.26,0.83,1.33],[0.5,11.27,0.84,1.1],
  ]),lod);
  const deckRing=scaled(1.075);
  for(const f of sides(deckRing)){
    panel(out,'trim',f,0,f.span,12.78,13.26,0,tone.pale);
    if(lod) for(let i=1;i<=5;i++){
      const s=f.span*i/6;
      const [x,,z]=f.p(s,0);
      B(out,'trim',x,12.48,z,0.13,0.34,0.135,tone.pale);
    }
  }
  cap(out,'roof',deckRing,13.25,tone.roofEdge);
  const n=8,r=0.86;
  const lantern=(i,y,radius=r)=>[center[0]+radius*Math.cos(2*Math.PI*i/n),y,center[1]+radius*Math.sin(2*Math.PI*i/n)];
  for(let i=0;i<n;i++){
    const j=i+1,m=2*Math.PI*(i+0.5)/n,normal=[Math.cos(m),0,Math.sin(m)];
    face(out,'window',[lantern(i,13.27),lantern(j,13.27),lantern(j,14.36),lantern(i,14.36)],normal,tone.glass);
    face(out,'roof',[lantern(i,14.36,r+0.14),lantern(j,14.36,r+0.14),lantern(j,14.82,0.29),lantern(i,14.82,0.29)],
      [0,1,0],tone.roofEdge);
    face(out,'roof',[lantern(i,14.82,0.29),lantern(j,14.82,0.29),[center[0],towerTop,center[1]]],[0,1,0],tone.roofEdge);
    if(lod) beam(out,'trim',lantern(i,13.25),lantern(i,14.38),0.055,0.058,tone.dark);
  }
}

function build(out,_frame,lod=3){
  residence(out,lod);
  porch(out,[-2.02,4.79,5.63,8.53],1,lod);
  porch(out,[-4.98,4.78,-7.83,-6.03],-1,lod);
  lightTower(out,lod);
}
export const lightSkyline=(out,frame)=>build(out,frame,0);
export const lightDistrict=(out,frame)=>build(out,frame,1);
export const lightStreet=(out,frame)=>build(out,frame,2);
export const lightCloseup=(out,frame)=>build(out,frame,3);

const recipe='light-model.mjs';
const camera=[-24,14,30],lookAt=[0,6,0];
export const lightModel={
  id:plan.model,key:plan.model,title:plan.title,cell:plan.cell,wikidataId:plan.wikidataId,
  recipe,surfaces,build,quality:'medium-fi-exterior',reviewStatus:'review-in-qa.json',
  geographicStatus:'historical-proposal',orientationPolicy:'approximate-visualization',progressLedger:'qualla-003.PROGRESS.md',
  brief:'The yellow Carpenter Gothic keeper house, raised porches and square lantern tower of Hereford Inlet Lighthouse.',
  appearance:{kind:'historical',representedDate:plan.representedDate,validFrom:plan.validFrom,validUntil:plan.validUntil,currentWorldEligible:false},
  camera,lookAt,
  buildingCutout:{outline:house,minimumCoverage:0.96,basis:'The mapped keeper-house footprint contains the tower and identifies the connected light station.'},
  mediumFiContext:{scale:0.78,groundY:0,terrain:{descriptor:'terrain-review.terrain.json',heightmap:'terrain-review.height.png'}},
  embeddedCanonicalGraphs:['wood_weatherboard','brick','slate','metal_painted'],
  qaCameras:[
    {name:'keeper-house-and-lantern-tower',position:[-20,9.4,25],lookAt:[-0.6,6.2,1]},
    {name:'front-porch-and-stair-rail',position:[11,4.8,20],lookAt:[1,3.1,7.6]},
    {name:'rear-porch-and-tower-cornice',position:[17,12,-23],lookAt:[0,6.4,-1]},
  ],
  qaLodCameras:['skyline','district','street','closeup'].map(reviewLod=>({name:'whole-hereford-inlet-lighthouse-'+reviewLod,position:camera,lookAt,reviewLod})),
  runtimeLodOverlay:{
    module:'content/worldgen/source/places/'+plan.cell+'/'+plan.model+'/models/'+recipe,
    level:'skyline',export:'lightSkyline',errorMeters:0.21,surfaces,
    authoredLevels:Object.fromEntries([
      ['district','lightDistrict',0.11],['street','lightStreet',0.044],['closeup','lightCloseup',0.015],
    ].map(([name,exportName,errorMeters])=>[name,{export:exportName,errorMeters,surfaces}])),
  },
  limitations:plan.limitations,
  sourceLicense:'Original deterministic geometry under the repository license. WhisperToMe released the cited exact photographs under CC0. OpenStreetMap contributors supply the mapped controls under ODbL.',
};
