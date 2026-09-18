// Diagnostic only. Generates synthetic media in an isolated directory; never changes a film cut.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {sha256,renderFingerprint,assertPreview} from './preview-provenance.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'preview-provenance-test-'));
const dest=path.resolve(process.argv[2]||'preview-timeline-change-proof.json');
fs.mkdirSync(path.join(stage,'tools'),{recursive:true});
for(const f of ['render-cut.mjs','otio.mjs','paths.mjs'])fs.copyFileSync(path.join(root,'tools',f),path.join(stage,'tools',f));
const proj=path.join(stage,'projects/garage-dream');fs.mkdirSync(path.join(proj,'deliveries/DIAGNOSTIC'),{recursive:true});fs.mkdirSync(path.join(proj,'cuts'),{recursive:true});
const source=path.join(proj,'deliveries/DIAGNOSTIC/source.mp4');
execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=24','-t','2','-an','-c:v','libx264','-pix_fmt','yuv420p',source]);
const srcSha=sha256(fs.readFileSync(source));const rendererSha=sha256(fs.readFileSync(path.join(root,'tools/render-cut.mjs')));const results=[];
for(const [name,frames] of [['A',24],['B',23]]){
 const cut={format:2,name:'diagnostic-'+name,output:{width:320,height:180},v1:[{id:'fixture',u:'fixture',scene:'TEST',folder:'repo-deliveries',file:'DIAGNOSTIC/source.mp4',start:0,end:frames,mute:true}],v2:[],a2:[]};
 const cp=path.join(proj,'cuts',name+'.json');fs.writeFileSync(cp,JSON.stringify(cut,null,2)+'\n');
 execFileSync(process.execPath,[path.join(stage,'tools/render-cut.mjs'),cp,'DIAGNOSTIC-'+name],{cwd:stage,stdio:['ignore','pipe','pipe'],maxBuffer:64e6});
 const receipt=JSON.parse(fs.readFileSync(path.join(proj,'renders/RECEIPTS','DIAGNOSTIC-'+name+'.mp4.receipt.json')));
 const output=path.join(proj,'renders','DIAGNOSTIC-'+name+'.mp4');const outputSha256=sha256(fs.readFileSync(output));const fingerprint=renderFingerprint(cut,rendererSha,{fixture:srcSha});
 assertPreview({expectedCutSha:sha256(fs.readFileSync(cp)),fingerprint,actualOutputSha:outputSha256,receipt,previous:results.at(-1)});
 results.push({name,frames,cutSha256:receipt.cutSha256,fingerprint,outputSha256,bytes:receipt.bytes});
}
if(results[0].outputSha256===results[1].outputSha256)throw new Error('timeline change did not change output');
const report={test:'one-frame timeline change changes rendered bytes',passed:true,scope:'isolated native-renderer integration; does not verify a deployed watcher',host:os.hostname(),rendererSha256:rendererSha,results,stage};
fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
