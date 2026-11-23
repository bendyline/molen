import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { deform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  facade, fan, fbox, gableRoof, opening, outwardRing, quad4, rgb, tri, wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.95 },
  steel: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.82 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.91 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.83 },
  gilding: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.88 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.51 },
  chapelGlass: {
    slot: 'window', localRef: 'palette:#e3e3e3', roughness: 0.36,
    alphaMode:'BLEND', baseColorFactor:[1,1,1,.54], doubleSided:true,
  },
};
const slate=rgb('777b78'), ash=rgb('a29a88'), bronze=rgb('8c7d58'), timber=rgb('b6a180'), brick=rgb('a37666');
const stone=rgb('b9b0a0'), glint=rgb('a3aba0'), lead=rgb('535b55'), glass=rgb('515e61');
const stained=['596564','566a73','646664','756d61','52646a','727b6c','637584'].map(rgb);
const { width, origin, along }=site.frame;
const frame=facade(origin,along), front=facade([0,0],[1,0]);
const footprint=outwardRing(site.plan);
const roof=site.roofProfile.map(([x,y])=>[x*width,y]);
const floor=.43;
const mix=(a,b,t)=>a+(b-a)*t;

function face(out,slot,f,a,b,lo,hi,d,color){
  const p=f.P;
  quad4(out,slot,p(a,lo,d),p(b,lo,d),p(b,hi,d),p(a,hi,d),color);
}

function foldedRoof(out,detail){
  const length=-site.naveBack,back=-(length+.36);
  const top=(x,y,z)=>[x, y-(Math.max(0,-z)/length)*Math.max(.14,(y-4.1)*.265), z];
  for(let i=1;i<roof.length;i++){
    const [a,y]=roof[i-1],[b,h]=roof[i];
    const p=[top(a,y,3.14),top(b,h,3.14),top(b,h,back),top(a,y,back)];
    quad4(out,'steel',...p,i%2===0?slate:rgb('7c807e'));
    quad4(out,'timber',...p.map(([x,y,z])=>[x,y-.17,z]).reverse(),timber);
    const [A,B,C,D]=p;
    for(const [p,q] of [[A,B],[C,D]]){
      const r=([x,y,z])=>[x,y-.17,z];
      quad4(out,'steel',r(p),r(q),q,p,lead);
    }
    const n=detail===0?1:Math.ceil((b-a)/(detail>1?.96:2.66));
    for(let j=0;j<n;j++){
      const t=j/n,x=mix(a,b,t),height=mix(y,h,t);
      const u=top(x,height+.034,3.071),v=top(x,height+.034,back+.10);
      if(detail>0)beam(out,'steel',u,v,.058,.065,lead);
      if(detail>1)beam(out,'timber',[u[0],u[1]-.20,u[2]],[v[0],v[1]-.20,v[2]],.061,.053,timber);
    }
  }
}

function greatWindow(out,detail){
  const p=front.P;
  for(let i=1;i<roof.length;i++){
    const [a,y]=roof[i-1],[b,h]=roof[i];
    const n=detail===0?1:Math.ceil((b-a)/(detail>1?1.07:2.33));
    const rows=[1,2,4,7][detail];
    for(let j=0;j<n;j++) {
      const t=j/n,next=(j+1)/n;
      const x=mix(a,b,t),u=mix(a,b,next);
      const left=mix(y,h,t)-.18,right=mix(y,h,next)-.18;
      for(let k=0;k<rows;k++){
        const lo=k/rows,hi=(k+1)/rows;
        const A=mix(floor,left,lo),B=mix(floor,right,lo),C=mix(floor,right,hi),D=mix(floor,left,hi);
        quad4(out,'glazing',p(x,A,-.055),p(u,B,-.055),p(u,C,-.055),p(x,D,-.055),stained[(i*9+j*7+k*11)%stained.length]);
        if(detail>1&&k>0)
          beam(out,'steel',p(x,A,.012),p(u,B,.012),.054,.053,lead);
      }
      if(detail>0) fbox(out,'steel',front,x-.035,x+.035,floor,left,-.105,.025,lead);
    }
  }
  fbox(out,'base',front,0,width,site.foundationBottom,floor,-.11,.08,ash);
  for(const ratio of [.19,.5,.81]){
    const u=width*ratio, span=ratio===.5?4.9:3.27;
    face(out,'glazing',front,u-span/2,u+span/2,floor+.04,3.19,.032,glass);
    if(detail>0) for(const x of [-span/2,0,span/2])
      fbox(out,'timber',front,u+x-.085,u+x+.085,floor,3.30,.04,.19,timber);
    if(detail>0)fbox(out,'timber',front,u-span/2-.08,u+span/2+.08,3.19,3.31,.03,.20,timber);
  }
  if(detail>0)for(let j=0;j<3;j++)
    fbox(out,'base',front,width*.29,width*.71,-.29,floor-j*.124,Math.max(0,j*.52-.27),.53+j*.52,stone);
}

function wingHeight([x,z]){
  if(z>-46.55)return 3.96;
  if(z>-70.7)return x<-.8?20.62:12.96;
  return 17.2;
}

function eastWestWalls(out,detail){
  for(const [i,a] of footprint.entries()){
    const b=footprint[(i+1)%footprint.length];
    if(Math.abs(a[1])+Math.abs(b[1])<.032)continue;
    const f=wallFace(a,b),l=f.length;
    if(l<.021)continue;
    const rail=Math.max(a[1],b[1])>-46.57, p=f.P;
    let A=wingHeight(a),B=wingHeight(b);
    if(rail&&Math.min(a[1],b[1])>-46.81)A=B=3.96;
    const stained=rail&&Math.abs(f.normal[0])>.85&&l>4.30;
    face(out,'base',f,0,l,site.foundationBottom,floor,0,ash);
    quad4(out,stained?'glazing':'brick',p(0,floor),p(l,floor),p(l,B),p(0,A),stained?glass:brick);
    const height=Math.min(A,B);
    if(detail===0)continue;
    face(out,rail?'steel':'base',f,0,l,height-.33,height-.12,.043,rail?lead:ash);
    if(l<3.28)continue;
    const n=Math.max(1,Math.round(l/(rail?2.72:4.48))), dx=l/n;
    for(let j=0;j<n;j++){
      const u=dx*(j+.5);
      if(rail){
        fbox(out,'base',f,u-.19,u+.19,floor,height,-.05,.17,stone);
      } else {
        const h=Math.min(5.26,height-4.21);
        const w=Math.min(1.53,dx-.49);
        if(h>1.45)opening(out,f,u,2.71,w,h,{
          head:detail>1?'pointed':'flat',rise:1.02,frameSlot:'base',glassSlot:'glazing',
          frame:stone,glass,frameWidth:.165,frameDepth:.17,d:.049,mullions:detail>1?1:0,
        });
      }
    }
  }
  const covered=deform(out,([x, ,z])=>[x,wingHeight([x,z])-.019,z]);
  cap(covered,'steel',footprint,0,slate);
}

function rose(out,detail) {
  const f=wallFace([29.455,-80.75],[8.62,-80.75]);
  const p=f.P,u=f.length/2,y=13.33,r=2.78,n=[10,15,24,30][detail];
  const point=(i,rad,d)=>p(u+rad*Math.cos(i*2*Math.PI/n),y+rad*Math.sin(i*2*Math.PI/n),d);
  const ring=(radius,d)=>Array.from({length:n},(_,i)=>point(i,radius,d));
  fan(out,'base',ring(r+.27,.058),stone);
  for(let i=0;i<n;i++){
    tri(out,'glazing',p(u,y,.088),point(i,r,.088),point(i+1,r,.088),stained[(i+3)%stained.length]);
    if(detail>0&&i%(detail>1?2:3)===0)
      beam(out,'base',point(i,r*.25,.12),point(i,r,.12),.102,.15,stone);
  }
  if(detail>1)fan(out,'base',ring(r*.24,.145),stone);
}

function chancel(out,detail){
  const x=19.04,from=-42.80,to=-80.76;
  for(const d of [-1,1]){
    const a=x+d*10.46,f=facade([a,d>0?from:to],[0,-d]);
    face(out,'brick',f,0,from-to,11.38,17.26,0,brick);
  }
  gableRoof(out,'steel',[x,from],[x,to],20.88,17.24,site.choirHeight,slate,{
    overhang:.24,endSlot:'brick',endColor:brick,
  });
  fbox(out,'brick',front,-5.20,3.42,12.91,20.63,-69.24,-57.89,brick);
  gableRoof(out,'steel',[-1.12,-68.91],[-1.12,-57.95],8.44,20.61,22.06,slate,{
    overhang:.16,endSlot:'brick',endColor:brick,
  });
  rose(out,detail);
}

function chapel(out,detail) {
  const ring=outwardRing(site.chapelPlan), low=.74;
  const shift=([x,z])=>[x,site.chapelRoof.base+(Math.max(0,-z-81)/17.1)*site.chapelRoof.rise+Math.cos((x-18.92)*.21)*.25,z];
  for(const [i,a] of ring.entries()){
    const b=ring[(i+1)%ring.length],f=wallFace(a,b);
    const l=f.length, p=f.P;
    const A=shift(a)[1], B=shift(b)[1];
    face(out,'base',f,0,l,site.foundationBottom,low,0,ash);
    quad4(out,'chapelGlass',p(0,low),p(l,low),p(l,B-.18),p(0,A-.18),glint);
    if(detail===0)continue;
    const segs=Math.max(1,Math.round(l/3.6));
    for(let j=0;j<=segs;j++){
      const t=j/segs,u=t*l,y=mix(A,B,t);
      fbox(out,'steel',f,u-.042,u+.042,low,y,-.049,.05,lead);
    }
  }
  cap(out,'base',ring,low,ash);
  const [a,b,c,d]=site.chapelPlan;
  const n=[3,5,8,12][detail];
  const edge=(a,b,t)=>shift([mix(a[0],b[0],t),mix(a[1],b[1],t)]);
  for(let i=0;i<n;i++){
    const t=i/n,k=(i+1)/n;
    const p=[edge(a,b,t),edge(a,b,k),edge(d,c,k),edge(d,c,t)];
    quad4(out,'copper',...p.slice().reverse(),bronze);
    quad4(out,'gilding',...p.map(([x,y,z])=>[x,y-.16,z]),rgb('c1a574'));
    if(detail>0)beam(out,'copper',p[0],p[3],.044,.054,bronze);
  }
}

function build(out,detail){
  const local=deform(out,([u,y,d])=>frame.P(u,y,d));
  eastWestWalls(local,detail);
  foldedRoof(local,detail);
  greatWindow(local,detail);
  chancel(local,detail);
  chapel(local,detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
