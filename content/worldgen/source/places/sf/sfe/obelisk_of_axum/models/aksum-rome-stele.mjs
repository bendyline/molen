import {
  facade, fbox, quad4, rgb, tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type:'json' };

export const surfaces = {
  granite:{slot:'wall',graph:'stone_granite',roughness:.99},
  base:{slot:'foundation',graph:'stone_limestone_raw',roughness:.98},
};

const granite=rgb('b8b29f'), edge=rgb('bfb9a8'), scour=rgb('aca493'), dark=rgb('8a8174'), plinth=rgb('a8a092');
const broad=facade([0,0],site.along), side=facade([0,0],broad.normal);
const faces=[
  {face:broad,width:site.baseWidth,depth:site.baseDepth,front:true},
  {face:side,width:site.baseDepth,depth:site.baseWidth},
  {face:facade([0,0],site.along.map(q=>-q)),width:site.baseWidth,depth:site.baseDepth},
  {face:facade([0,0],broad.normal.map(q=>-q)),width:site.baseDepth,depth:site.baseWidth},
];
const scale=y=>1-.162*Math.max(0,y)/site.capStart;

function place(face,u,y,depth=0) {
  return face.face.P(u*scale(y),y,face.depth*.5*scale(y)+depth);
}
function patch(out,face,a,b,y,Y,d,color){
  quad4(out,'granite',place(face,a,y,d),place(face,b,y,d),place(face,b,Y,d),place(face,a,Y,d),color);
}
function groove(out,face,a,b,y,Y,detail) {
  patch(out,face,a,b,y,Y,.013,dark);
  if(detail===0)return;
  patch(out,face,a-.048,a,y-.042,Y+.044,.038,edge);
  patch(out,face,b,b+.048,y-.042,Y+.044,.038,edge);
  patch(out,face,a-.041,b+.041,Y,Y+.043,.037,granite);
  patch(out,face,a-.041,b+.041,y-.048,y,.037,edge);
  if(detail>1){
    const c=(a+b)*.5;
    patch(out,face,c-.019,c+.019,y,Y,.031,scour);
    patch(out,face,a,b,y+.15*(Y-y),y+.15*(Y-y)+.024,.026,edge);
  }
}
function carving(out,face,detail) {
  const half=face.width*.5;
  patch(out,face,-half,half,-.45,site.capStart,0,granite);
  if(face.front){
    groove(out,face,-.47,.47,.23,2.12,detail);
    patch(out,face,-.66,.64,2.18,2.23,.027,scour);
  }
  const windows=face.width>2?3:2;
  const carveWidth=face.width*.74;
  for(let stage=0;stage<site.storeys;stage++){
    const floor=site.firstStorey+stage*site.storeyPitch;
    patch(out,face,-half+.009,half-.009,floor,floor+.063,.039,edge);
    patch(out,face,-half+.015,half-.015,floor+.06,floor+.101,.016,dark);
    if(detail===0&&stage%2)continue;
    for(let i=0;i<windows;i++){
      const u=-carveWidth*.5+carveWidth*(i+.5)/windows, w=carveWidth*.252/windows;
      groove(out,face,u-w,u+w,floor+.97,floor+1.53,detail);
    }
    if(detail===0)continue;
    const beams=face.width>2?8:4;
    for(let i=0;i<beams;i++){
      const u=face.width*((i+.5)/beams-.5);
      patch(out,face,u-.055,u+.055,floor+.32,floor+.43,.041,scour);
      if(detail>1)patch(out,face,u-.048,u+.048,floor+.66,floor+.72,.034,edge);
    }
    patch(out,face,-half+.018,half-.018,floor+1.63,floor+1.688,.027,dark);
  }
}
function crown(out,detail) {
  const y=site.capStart,d=site.baseDepth*scale(y)*.5,r=site.baseWidth*scale(y)*.5;
  const steps=[8,12,16,20][detail];
  const outline=[[-r,y],[-.71*r,22.44],[-.59*r,22.81],[-r,22.86]];
  for(let i=1;i<steps;i++){
    const a=Math.PI*(1-i/steps);
    outline.push([r*Math.cos(a),22.86+(site.height-22.86)*Math.sin(a)]);
  }
  outline.push([r,22.86],[r*.64,22.73],[r*.72,22.40],[r,y]);
  const P=(u,yy,depth)=>broad.P(u,yy,depth);
  const center=[0,22.765];
  for(const [i,[u,Y]] of outline.entries()){
    const [v,Z]=outline[(i+1)%outline.length];
    quad4(out,'granite',P(u,Y,-d),P(u,Y,d),P(v,Z,d),P(v,Z,-d),edge);
    tri(out,'granite',P(...center,d),P(v,Z,d),P(u,Y,d),granite);
    tri(out,'granite',P(...center,-d),P(u,Y,-d),P(v,Z,-d),granite);
  }
  if(detail>0){
    const cy=23.21;
    for(let i=0;i<steps;i++){
      const a=2*Math.PI*i/steps,b=2*Math.PI*(i+1)/steps;
      const at=th=>P(.258*Math.cos(th),cy+.194*Math.sin(th),d+.012);
      tri(out,'granite',P(0,cy,d+.013),at(a),at(b),dark);
    }
  }
}
function build(out,detail){
  fbox(out,'base',broad,-2.01,2.01,-.54,.075,-1.63,1.63,plinth);
  for(const face of faces)carving(out,face,detail);
  crown(out,detail);
}
export const buildSkyline=out=>build(out,0);
export const buildDistrict=out=>build(out,1);
export const buildStreet=out=>build(out,2);
export const buildCloseup=out=>build(out,3);
export const buildMaster=buildCloseup;
