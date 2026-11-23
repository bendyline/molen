import { beam, beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { outwardRing, quad4, rgb, tri, wallFace } from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  frame: { slot: 'wall', graph: 'concrete_panel', roughness: .91 },
  fins: { slot: 'roof', graph: 'metal_standing_seam', roughness: .87 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: .88 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: .96 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: .58 },
};
const shell=rgb('cccfc9'), white=rgb('d6d7d0'), shadow=rgb('a9ada6');
const pale=rgb('bac1ba'), dark=rgb('606e70'), glass=rgb('68878b'), solar=rgb('5c7880');
const basalt=rgb('9c9e90'), pool=rgb('759f9b');
const {origin,tangent,cross,start,end,samples,roofProfile}=site.frame;
const length=end-start;
const lerp=(a,b,t)=>a+(b-a)*t;
const P=(u,v,y)=>[origin[0]+tangent[0]*u+cross[0]*v,y,origin[1]+tangent[1]*u+cross[1]*v];

function between(rows,value) {
  const index=rows.findIndex(r=>r[0]>=value);
  if(index===0)return rows[0].slice(1);
  if(index<0)return rows.at(-1).slice(1);
  const a=rows[index-1], b=rows[index], t=(value-a[0])/(b[0]-a[0]);
  return a.slice(1).map((n,i)=>lerp(n,b[i+1],t));
}

function station(u) {
  const [left,right]=between(samples,u),[edge,peak]=between(roofProfile,(u-start)/length);
  return {u,left,right,center:(left+right)*.5,edge,peak};
}

function shellPoint(s,t,offset=0) {
  const v=lerp(s.left,s.right,t), y=lerp(s.edge,s.peak,1-Math.pow(Math.abs(2*t-1),1.65));
  return P(s.u,v,y+offset);
}

function supportRail(out, detail, rows, t) {
  const line=rows.map(s=>shellPoint(s,t));
  beamPath(out,'frame',line,detail===0?1.39:1.64,t===.5?.91:1.22,shell);
}

function shellRib(out,detail,s) {
  const marks=detail===0?[0,.5,1]:detail===1?[0,.24,.5,.76,1]:[0,.13,.31,.5,.69,.87,1];
  beamPath(out,'frame',marks.map(t=>shellPoint(s,t,-.075)),
    detail===0?.95:.83,detail===3?.41:.53,white);
}

function slats(out,detail,a,b) {
  for(const [left,right] of [[.042,.473],[.527,.958]]){
    const low=shellPoint(a,left,.151),high=shellPoint(a,right,.151);
    const back=shellPoint(b,left,.151),edge=shellPoint(b,right,.151);
    quad4(out,'fins',low,high,edge,back,pale);
    quad4(out,'fins',back,edge,high,low,shadow);
    if(detail>1) {
      const ctr=(p,q,t)=>p.map((v,i)=>lerp(v,q[i],t)+(i===1?.018:0));
      const c=ctr(low,back,.19),d=ctr(high,edge,.19),e=ctr(high,edge,.76),f=ctr(low,back,.76);
      quad4(out,'fins',c,d,e,f,solar);
    }
  }
}

function canopy(out,detail) {
  const count=[8,20,30,52][detail];
  const stations=Array.from({length:count+1},(_,i)=>{
    const n=count;
    return station(start+.14+(length-.28)*i/n);
  });
  for(const t of [0,.5,1])supportRail(out,detail,stations,t);
  const ribs=[6,12,23,29][detail];
  for(let i=0;i<=ribs;i++) {
    const u=start+1.1+(length-2.2)*i/ribs;
    shellRib(out,detail,station(u));
  }
  const n=[16,32,66,102][detail];
  for(let i=0;i<n;i++){
    const u=start+1.57+(length-3.14)*(i+.5)/n;
    slats(out,detail,station(u-.33),station(u+.33));
  }
  const north=station(end-.77), south=station(start+1.03);
  for(const tip of [north,south]) {
    const a=shellPoint(tip,0,-.12),b=shellPoint(tip,1,-.12),c=shellPoint(tip,.5,-.18);
    beam(out,'frame',a,b,1.01,.91,shell);
    beam(out,'frame',a,c,.79,.75,white);
    beam(out,'frame',c,b,.79,.75,white);
  }
}

function hallSection(u) {
  const s=station(u), half=(s.right-s.left)*.299;
  return {u,left:s.center-half,right:s.center+half,center:s.center};
}

function hall(out,detail) {
  const {city,sea}=site.supports;
  const n=[7,14,23,32][detail], rows=Array.from({length:n+1},(_,i)=>hallSection(lerp(city,sea,i/n)));
  const deck=site.pierDeck, eave=10.21;
  for(let i=1;i<rows.length;i++){
    const a=rows[i-1],b=rows[i];
    for(const side of ['left','right']){
      const ap=(h,d=0)=>P(a.u,a[side]+d,h),bp=(h,d=0)=>P(b.u,b[side]+d,h);
      const panel=(slot,y,Y,d,color)=>{
        const corners=[ap(y,d),bp(y,d),bp(Y,d),ap(Y,d)];
        quad4(out,slot,...(side==='right'?corners:corners.slice().reverse()),color);
      };
      panel('base',-2.01,deck+.14,0,basalt);
      panel('glass',deck+.14,3.91,0,glass);
      panel('frame',3.91,5.81,.044,white);
      panel('glass',5.81,9.57,-.04,glass);
      panel('frame',9.57,eave,.047,shell);
      if(detail)beam(out,'trim',ap(deck+.14,.051),ap(eave-.2,.051),.16,.12,dark);
    }
    quad4(out,'fins',P(a.u,a.right,eave),P(b.u,b.right,eave),P(b.u,b.left,eave),P(a.u,a.left,eave),shadow);
  }
  for(const [i,s] of [rows[0],rows.at(-1)].entries()){
    const left=P(s.u,s.left,deck),right=P(s.u,s.right,deck);
    const above=P(s.u,s.center,12.68),spring=P(s.u,s.center,6.65);
    const ridge=station(s.u), top=shellPoint(ridge,.5,-.54), anchors=[];
    for(let k=0;k<=[5,9,13,17][detail];k++){
      const n=[5,9,13,17][detail],t=k/n,v=lerp(s.left,s.right,t);
      const point=P(s.u,v,lerp(6.65,12.68,Math.sin(Math.PI*t)));
      anchors.push(point);
      if(k>0){
        const corners=[anchors[k-1],point,spring];
        tri(out,'glass',...(i===0?corners:corners.slice().reverse()),glass);
      }
      if(detail)beam(out,'trim',P(s.u,v,deck+.07),point,.125,.095,steel);
    }
    const a=anchors[0],b=anchors.at(-1);
    const corners=[left,right,b,a];
    quad4(out,'glass',...(i===0?corners:corners.slice().reverse()),glass);
    beamPath(out,'frame',anchors,.32,.19,shell);
    beam(out,'frame',above,top,.68,.71,white);
    for(const t of [0,1]){
      const foot=P(s.u,t?s.right:s.left,deck), rail=shellPoint(ridge,t);
      beam(out,'frame',foot,rail,1.24,1.46,shell);
    }
  }
}

const steel=rgb('747e7c');
function reflectingPools(out){
  for(const basin of site.pools){
    const r=outwardRing(basin.outline);
    cap(out,'glass',r,.23,pool);
    for(const [i,a] of r.entries()){
      const f=wallFace(a,r[(i+1)%r.length]),p=f.P;
      quad4(out,'base',p(0,.22),p(f.length,.22),p(f.length,site.pierDeck),p(0,site.pierDeck),basalt);
    }
  }
}

function build(out,detail){
  canopy(out,detail);
  hall(out,detail);
  reflectingPools(out);
}

export const buildSkyline=out=>build(out,0);
export const buildDistrict=out=>build(out,1);
export const buildStreet=out=>build(out,2);
export const buildCloseup=out=>build(out,3);
export const buildMaster=buildCloseup;
