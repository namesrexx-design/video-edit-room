import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createSyncServer,byteRange,safeFile} from './serve-storyboard-sync.mjs';
test('source refresh updates scene selection and preserves last good view on failure',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'storyboard-sync-'));
 const original={scenes:[{id:'S08',status:'old',still:{sheet:'old.jpg'},v74:{inCut:false}}],characters:[{name:'Rexx'}]};
 fs.writeFileSync(path.join(root,'board.json'),JSON.stringify(original));fs.writeFileSync(path.join(root,'storyboard.html'),'<title>LYFE</title>');fs.writeFileSync(path.join(root,'clip.mp4'),'0123456789');
 let fail=false,version='one';
 const app=createSyncServer({root,intervalMs:60000,readSource:async()=>{if(fail)throw Error('offline');return {revision:version,source:{scenes:[{id:'S08',status:version,fullVideo:'https://example.com/complete.mp4',completedDelivery:{selectedForStoryboard:true,src:'https://example.com/complete.mp4'}}]}};}});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 try{
 await app.refresh();let board=await fetch(base+'/board.json').then(r=>r.json());assert.equal(board.scenes[0].status,'one');assert.deepEqual(board.characters,original.characters);assert.deepEqual(board.scenes[0].v74,{inCut:false});
 version='two';await app.refresh();board=await fetch(base+'/board.json').then(r=>r.json());assert.equal(board.scenes[0].status,'two');
 fail=true;await app.refresh();assert.equal((await fetch(base+'/board.json').then(r=>r.json())).scenes[0].status,'two');assert.match((await fetch(base+'/api/storyboard-sync').then(r=>r.json())).error,/unavailable/);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'board.json'))),original);
 assert.match(await fetch(base+'/storyboard.html').then(r=>r.text()),/storyboard-sync-client.js/);
 const range=await fetch(base+'/clip.mp4',{headers:{Range:'bytes=2-4'}});assert.equal(range.status,206);assert.equal(await range.text(),'234');
 assert.equal((await fetch(base+'/clip.mp4',{headers:{Range:'bytes=100-'}})).status,416);
 assert.equal((await fetch(base+'/board.json',{method:'POST'})).status,405);assert.equal(safeFile(root,'/../secret'),null);
 }finally{await new Promise(r=>app.server.close(r));fs.rmSync(root,{recursive:true});}
});
test('range bounds',()=>{assert.deepEqual(byteRange('bytes=-3',10),{start:7,end:9});assert.equal(byteRange('bytes=9-2',10),null);assert.equal(byteRange('bytes=0-2,4-6',10),null);});
