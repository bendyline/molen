import { loft } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { deform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  facade, fbox, opening, outwardRing, quad4, rgb, roundArch, wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  render: { slot: 'wall', graph: 'stucco', roughness: 0.94 },
  carved: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.93 },
  shutter: { slot: 'trim', graph: 'wood_painted_lap', roughness: 0.91 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.54 },
};
const pale = rgb('d8d4c4'), trim = rgb('e3ddcc'), stone = rgb('96958b');
const mid = rgb('bdb8a8'), blue = rgb('868987'), glass = rgb('62665e'), slat = rgb('b8b9b3');
const { floor, upper, eave, clearance, openingSpans } = site.loggia;
const { width } = site.frame;
const frame = facade(site.frame.origin, site.frame.along);
const front = facade([0, 0], [1, 0]);
const outline = outwardRing(site.plan);

function face(out, slot, f, a, b, low, high, d, color) {
  const p = f.P;
  quad4(out, slot, p(a, low, d), p(b, low, d), p(b, high, d), p(a, high, d), color);
}

function top(x, z) {
  if (x >= -0.02 && z > -11.41) return eave;
  return 8.31 - 1.27 * Math.min(1, Math.max(0, -x - 21) / 19);
}

function body(out, detail) {
  for (const [i,a] of outline.entries()) {
    const b=outline[(i+1)%outline.length];
    if (Math.abs(a[1])+Math.abs(b[1])<0.024)continue;
    const f=wallFace(a,b), l=f.length, ta=top(...a), tb=top(...b);
    if(l<0.021)continue;
    face(out,'base',f,0,l,site.foundationBottom,floor,0,stone);
    const P=f.P;
    quad4(out,'render',P(0,floor),P(l,floor),P(l,tb),P(0,ta),pale);
    const limit=Math.min(ta,tb);
    face(out,'carved',f,0,l,limit-.285,limit-.11,0.061,trim);
    if(detail===0||l<3.45)continue;
    const bays=Math.max(1,Math.round(l/4.62));
    for(let j=0;j<bays;j++){
      const u=(j+.5)*l/bays, w=Math.min(1.65,l/bays-.45);
      for (const y of [1.81,limit-2.85]){
        if(detail===1)face(out,'glazing',f,u-w/2,u+w/2,y,y+1.72,0.048,glass);
        else opening(out,f,u,y,w,1.72,{head:'flat',glassSlot:'glazing',frameSlot:'carved',glass,
          frame:trim, d:.049,frameWidth:.1,frameDepth:.12,mullions:1,transoms:1,mullionColor:mid});
      }
    }
  }
  const roof = deform(out, ([x, , z]) => [x, top(x,z), z]);
  cap(roof,'roof',outline,0,blue);
}

function rail(out, detail, a, b, level, d, f = front) {
  const l=b-a;
  fbox(out,'carved',f,a,b,level+.52,level+.62,d-.11,d+.12,trim);
  if(detail===0)return;
  const n=Math.max(2,Math.round(l/[0,.63,.37,.26][detail]));
  for(let j=0;j<n;j++){
    const u=a+l*(j+.5)/n;
    fbox(out,'carved',f,u-.052,u+.052,level+.02,level+.53,d-.079,d+.077,trim);
    if(detail>1)fbox(out,'carved',f,u-.075,u+.075,level+.21,level+.38,d-.092,d+.094,trim);
  }
}

function arch(out, detail, z, a, b, level, ceiling) {
  const f=front, p=f.P, center=(a+b)/2,r=(b-a)/2;
  const spring=level+2.39;
  const points=roundArch(r,[4,6,10,14][detail]);
  for(let i=1;i<points.length;i++){
    const [x,y]=points[i-1],[u,v]=points[i];
    quad4(out,'render',p(center+x,spring+y,z),p(center+u,spring+v,z),p(center+u,ceiling,z),p(center+x,ceiling,z),pale);
    quad4(out,'carved',p(center+u,spring+v,z),p(center+x,spring+y,z),
      p(center+x,spring+y,z-.26),p(center+u,spring+v,z-.26),mid);
    if(detail>0){
      const q=(x,y)=>p(center+x*(1+.144/r),spring+y*(1+.144/r),z+.074);
      quad4(out,'carved',p(center+x,spring+y,z+.075),p(center+u,spring+v,z+.075),q(u,v),q(x,y),trim);
    }
  }
  if(detail===0)return;
  for(let y=.068;y<r*.95;y+=detail===1?.33:detail===2?.172:.112){
    const half=Math.sqrt(r*r-y*y)*.94;
    fbox(out,'shutter',f,center-half,center+half,spring+y-.026,spring+y+.028,z-.35,z-.29,slat);
  }
}

function loggia(out, detail) {
  face(out,'base',front,0,width,site.foundationBottom,floor,0,stone);
  for(const [level,ceiling] of [[floor,upper],[upper,eave]]){
    const insets=[0,...openingSpans.flat(),width];
    for(let i=0;i<insets.length;i+=2) {
      const [a,b]=[insets[i],insets[i+1]];
      fbox(out,'render',front,a,b,level,ceiling,-.29,0,pale);
      if(detail>0){
        const c=(a+b)/2;
        for(const y of [level+.16,level+2.31,ceiling-.34])
          fbox(out,'carved',front,c-(b-a)*.52,c+(b-a)*.52,y,y+.129,-.24,.10,trim);
      }
    }
    for(const [i,[a,b]] of openingSpans.entries()){
      arch(out,detail,0,a,b,level,ceiling);
      const u=(a+b)/2;
      face(out,'glazing',front,u-(b-a)*.39,u+(b-a)*.39,level+.16,level+3.84,-clearance+.019,glass);
      if(i>=1&&i<=3)rail(out,detail,a+.064,b-.064,level,-.08);
    }
    face(out,'render',front,0,width,level-.12,ceiling,-clearance,pale);
    fbox(out,'carved',front,0,width,level-.22,level+.046,-clearance,.165,trim);
  }
  fbox(out,'carved',front,-.15,width+.15,eave-.27,eave+.03,-clearance,.31,trim);
  for(const [a,b] of [[1.11,4.71],[5.04,12.7],[13.08,width-.9]])rail(out,detail,a,b,eave+.32,-.27);
  for(const u of [.8,4.86,12.9,width-.65])fbox(out,'carved',front,u-.22,u+.22,eave,eave+1.1,-.48,.06,trim);
  for(let i=0;i<3;i++){
    const y=floor-(i+1)*.175;
    fbox(out,'base',front,.44,2.30,-.39,y,0,.53+i*.39,stone);
  }
}

function hip(out, detail, x0, x1, d0, d1, eave, ridge) {
  const [x,d]=[(x0+x1)/2,(d0+d1)/2];
  const a=Math.max(.066,((x1-x0)-(d1-d0))*.33);
  const b=Math.max(.066,((d1-d0)-(x1-x0))*.33);
  const low=[[x0,eave,d0],[x0,eave,d1],[x1,eave,d1],[x1,eave,d0]];
  const high=[[x-a,ridge,d-b],[x-a,ridge,d+b],[x+a,ridge,d+b],[x+a,ridge,d-b]];
  loft(out,'roof',[low,high],blue);
  if(detail>0){
    const lip=low.map(([x,y,z])=>[x,y-.11,z]);
    loft(out,'carved',[lip,low],trim,{cap:false});
  }
}

function build(out, detail) {
  const local=deform(out,([u,y,d])=>frame.P(u,y,d));
  body(local,detail);
  loggia(local,detail);
  hip(local,detail,.39,width-.33,-11.74,-2.71,eave-.024,13.06);
  hip(local,detail,-1.61,13.89,-46.24,-18.62,8.28,10.89);
  hip(local,detail,-18.38,-1.28,-45.87,-20.43,8.26,10.57);
  hip(local,detail,-58.45,-25.58,-30.05,-17.63,7.07,8.92);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
