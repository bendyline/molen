/** Whole native equipment-base body; no assumed identity for any upper apparatus. */
import fs from 'node:fs';import path from 'node:path';import{createHash}from'node:crypto';
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
export function inspectMroBasePrimaryFacts({dir,proof,controls:P,frame:f}){
 const fail=reason=>({status:'needs-review',reason});
 try{
  const safe=p=>typeof p==='string'&&!path.isAbsolute(p)&&!p.split(/[\\/]/).includes('..'),source=proof.primarySources?.find(s=>s.key==='base-record'),native=proof.nativeIdentity;
  if(!safe(source?.path)||!safe(native?.path))return fail('mro-base-source-path-invalid');
  const bytes=fs.readFileSync(path.join(dir,source.path)),nativeBytes=fs.readFileSync(path.join(dir,native.path)),j=JSON.parse(bytes),w=j.feature;
  if(hash(bytes)!==source.sha256||hash(nativeBytes)!==native.sha256||source.url!=='https://www.openstreetmap.org/way/632829123'||source.use!=='original-numerical-map-record-only'||native.featureId!=='way/632829123'||j.originalWholeSiteHash!=='sha256:12e73e8e093a55a957f855e85b279d9c49acb1cbad20c5432fa03812fe4d0c7d'||j.underlyingImageryUsed!==false)return fail('mro-base-original-record-unbound');
  if(w.id!=='632829123'||w.type!=='way'||w.tags.building!=='yes'||w.tags.description!=='antenna base, contains some equipment.'||w.coordinates.length!==13||j.nearestKnownASKAP.distanceMeters<300)return fail('mro-base-whole-independent-identity-unbound');
  if(P.model!=='murchison_northwest_equipment_base'||P.parentModelIdentity!=='murchison_radio_astronomy_observatory'||P.kind!=='whole-native-equipment-base-body'||proof.case!=='mro-primary-whole-native-equipment-base-way632829123-2013-estimated'||P.nativeRing.length!==12||P.upperAntennaIdentityVerified!==false||P.upperAntennaModeled!==false||P.estimatedSectionUncertaintyMeters<2||P.estimatedComponentUncertaintyMeters<.5||P.representedDate!=='2013-12-31'||P.foundationBottom>=P.floor||P.floor>=P.eave||P.eave>=P.roofTop||P.roofTop>=P.mountTop)return fail('mro-base-whole-scope-or-estimates-overclaimed');
  const ring=w.coordinates.slice(0,-1),anchor=[0,1].map(k=>ring.reduce((s,p)=>s+p[k]/12,0)),rad=Math.PI/180,D=6378137*rad,co=Math.cos(anchor[1]*rad);
  if(f.heading!==0||anchor.some((v,k)=>Math.abs(v-f.anchor[k])>1e-10))return fail('mro-base-native-body-moved');
  for(const[i,p]of ring.entries()){const local=[(p[0]-anchor[0])*D*co,-6378137*(Math.asinh(Math.tan(p[1]*rad))-Math.asinh(Math.tan(anchor[1]*rad)))*co];if(local.some((v,k)=>Math.abs(v-P.nativeRing[i][k])>1e-7||Math.abs(v-f.geometry.polygons[0][i][k])>1e-7))return fail('mro-base-original-outside-controls-changed');}
  return{status:'passed',method:'primary-facts-only',imageryUsed:false,evidenceHash:hash(Buffer.from(JSON.stringify(proof))),notes:'Whole independent original12corner equipment-basebody, not a knownASKAPpoint. Nativebuilding/antenna-base-containingequipmentdescription only. Height/roof/concretefinish/serviceaccess/vent/mountingboss and2013survival estimated. Upperantennaidentity/form unverified; no inventedapparatus or absenceclaim. Allappearanceimageryunused; wholeobservatoryseparate.'};
 }catch{return fail('mro-base-evidence-unreadable');}
}
