/** Whole power/data hub from written engineering controls; no appearance imagery. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
export function inspectMroHubPrimaryFacts({dir,proof,controls:P,frame:f}){
 const fail=reason=>({status:'needs-review',reason});
 try{
  const safe=p=>typeof p==='string'&&!path.isAbsolute(p)&&!p.split(/[\\/]/).includes('..'),sources=Object.fromEntries(proof.primarySources.map(s=>[s.key,s]));
  for(const s of[...proof.primarySources,proof.nativeIdentity])if(!safe(s.path)||hash(fs.readFileSync(path.join(dir,s.path)))!==s.sha256)return fail('mro-hub-original-source-hash-unbound');
  const pdf=sources['engineering-pdf'],text=sources['engineering-text'];
  if(pdf?.url!=='https://arxiv.org/pdf/1206.6945'||text?.url!==pdf.url||pdf.use!=='written-facts-only'||text.use!=='factual-text-only'||pdf.sha256!=='sha256:fcc8db40185c0204f8b0473ae89d4b3fa1746a40db8f1a1590e11243b86a049d')return fail('mro-hub-original-engineering-record-unbound');
  const t=fs.readFileSync(path.join(dir,text.path),'utf8').replace(/\s+/g,' '),control=JSON.parse(fs.readFileSync(path.join(dir,proof.nativeIdentity.path)));
  if(!['separate but adjacent','concrete plinths','switchboard','transformer','patch panel','(0,-200)'].every(s=>t.includes(s)))return fail('mro-hub-whole-written-arrangement-missing');
  const facts=control.sourceFacts;
  if(control.originalPDFHash!==pdf.sha256||control.dimensionsMeasured!==false||control.nativeMappedHubPointProvided!==false||control.continuityFrom2012To2013Verified!==false||proof.nativeIdentity.nativeHubPointVerified!==false||facts.separateAdjacentConcretePlinths!==2||!facts.transformer||!facts.lowVoltageSwitchboardKiosk||!facts.fibrePatchEnvironmentalEnclosure||!facts.bottomCableEntries||!facts.centralProcessingFacilitySeparate)return fail('mro-hub-factual-scope-disagrees');
  const origin=[116+40/60+14.93485/3600,-26-42/60-11.94986/3600],anchor=[origin[0],origin[1]-200/(6378137*Math.PI/180)];
  if(P.model!=='murchison_widefield_array_distribution_hub'||P.parentModelIdentity!=='murchison_radio_astronomy_observatory'||P.kind!=='whole-primary-two-plinth-distribution-hub'||proof.case!=='mro-primary-whole-two-plinth-distribution-hub-written200m-2013'||P.nativeHubPointVerified!==false||P.positionAllowanceMeters<50||P.estimatedSectionUncertaintyMeters<2||P.estimatedSpacingUncertaintyMeters<2||P.estimatedComponentUncertaintyMeters<.5)return fail('mro-hub-estimated-dimensions-or-identity-overclaimed');
  if(f.heading!==0||anchor.some((v,k)=>Math.abs(v-f.anchor[k])>1e-10)||JSON.stringify(P.arrayOrigin)!==JSON.stringify(origin)||JSON.stringify(P.hubEastNorthMeters)!=='[0,-200]'||JSON.stringify(f.geometry.centerlines)!=='[[[0,0],[0,-200]]]'||control.hubEastNorthMeters[1]!==-200)return fail('mro-hub-written-position-vector-changed');
  if(P.plinths?.length!==2||P.plinths[0].id!=='power'||P.plinths[1].id!=='fibre'||P.floor<=P.foundationBottom||P.representedDate!=='2013-12-31')return fail('mro-hub-whole-two-plinth-or-phase-incomplete');
  for(const [i,c]of[P.kiosk,P.fibreCabinet].entries()){const p=P.plinths[i];if(![p.width,p.depth,c.width,c.depth,c.height].every(v=>Number.isFinite(v)&&v>0)||Math.abs(c.center[0]-p.center[0])+c.width/2>p.width/2||Math.abs(c.center[1]-p.center[1])+c.depth/2>p.depth/2)return fail('mro-hub-cabinet-foundation-incoherent');}
  if(P.plinths[0].center[0]+P.plinths[0].width/2>=P.plinths[1].center[0]-P.plinths[1].width/2)return fail('mro-hub-adjacent-plinths-not-separate');
  return{status:'passed',method:'primary-facts-only',imageryUsed:false,evidenceHash:hash(Buffer.from(JSON.stringify(proof))),notes:'Whole primary-written two-plinth distribution hub: compact transformer/LV kiosk and separate fibre-patch enclosure. Written approximate200msouth/numericarrayorigin retained as derivedauthorregistration, not a surveyednativehubpoint. Externaldimensions/spacing/finish and2013continuity explicitlyestimated. Allappearanceimageryunused; wholeparentseparate.'};
 }catch{return fail('mro-hub-evidence-unreadable');}
}
