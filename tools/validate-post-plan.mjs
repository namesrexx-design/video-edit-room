import fs from 'node:fs';
import path from 'node:path';
const file=process.argv.slice(2).find(a=>!a.startsWith('--'))||'projects/garage-dream/content/post-plan.json';
const plan=JSON.parse(fs.readFileSync(file,'utf8')),errors=[];
const keys=['id','asset','aspect','duration_s','platforms','captions','first_comment','hashtags','cta','disclaimer'];
const platforms=['tiktok','instagram','facebook','x','youtube','linkedin'];
const ids=new Set();
if(!Array.isArray(plan)||!plan.length)throw new Error('post plan must be a nonempty array');
for(const p of plan){
 for(const k of keys)if(!(k in p))errors.push(`${p.id}: missing ${k}`);
 if(ids.has(p.id))errors.push(`duplicate id ${p.id}`);ids.add(p.id);
 if(!['16:9','9:16'].includes(p.aspect)||!(p.duration_s>0))errors.push(`${p.id}: invalid aspect or duration`);
 if(typeof p.asset!=='string'||path.isAbsolute(p.asset)||p.asset.split('/').includes('..'))errors.push(`${p.id}: unsafe asset path`);
 if(!Array.isArray(p.platforms)||p.platforms.some(k=>!platforms.includes(k)))errors.push(`${p.id}: invalid platforms`);
 if(!Array.isArray(p.hashtags)||p.hashtags.some(h=>!/^#[\p{L}\p{N}_]+$/u.test(h)))errors.push(`${p.id}: invalid hashtags`);
 for(const k of ['default',...platforms]){
  const text=p.captions?.[k];if(typeof text!=='string'||!text.endsWith(p.cta)||!/tag/i.test(p.cta)||!/share/i.test(p.cta))errors.push(`${p.id}/${k}: missing final tag-and-share CTA`);
  if(/guarantee|\bearn\b|\bincome\b|million views|\b\d+[%$]/i.test(text||''))errors.push(`${p.id}/${k}: review results or income claim`);
  if(k==='x'&&[...text].length>280)errors.push(`${p.id}/x: over 280 characters`);
 }
 if(p.id.startsWith('FULL-FILM')){const disclaimer='Inspired by real-life experiences. Characters and situations are dramatized.';if(p.disclaimer!==disclaimer||Object.values(p.captions).some(t=>!t.includes(disclaimer)))errors.push(`${p.id}: full-film disclaimer missing`);}
}
const root=process.argv.includes('--require-assets')?process.cwd():null;
const missing=root?plan.filter(p=>!fs.existsSync(path.join(root,p.asset))).map(p=>p.asset):[];
if(missing.length)errors.push(...missing.map(p=>'not delivered: '+p));
console.log(JSON.stringify({records:plan.length,schemaPassed:!errors.some(e=>!e.startsWith('not delivered:')),assetsChecked:Boolean(root),errors},null,2));
if(errors.length)process.exitCode=1;
