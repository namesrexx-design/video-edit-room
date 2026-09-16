import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
export function mergeBoard(view, source) {
  if (!source) return view;
  const byId = new Map(source.scenes.map(s => [s.id,s]));
  return {...view, scenes:view.scenes.map(scene=>{
    const fresh=byId.get(scene.id); if(!fresh)return scene;
    const result={...scene};
    for(const key of ['title','line','status','editStatus','completedDelivery','approvedVideos','fullVideo','videoHasAudio']) if(fresh[key]!==undefined) result[key]=fresh[key];
    if(fresh.completedDelivery?.selectedForStoryboard) result.video=fresh.fullVideo;
    return result;
  })};
}
export function safeFile(root,urlPath) {
  const target=path.resolve(root,'.'+urlPath);
  const rel=path.relative(root,target);
  if(rel.startsWith('..')||path.isAbsolute(rel))return null;
  if(!fs.existsSync(target)||!fs.statSync(target).isFile())return null;
  const real=fs.realpathSync(target), base=fs.realpathSync(root);
  return real.startsWith(base+path.sep)?real:null;
}
export function byteRange(header,size){
  const m=/^bytes=(\d*)-(\d*)$/.exec(header||''); if(!m||(!m[1]&&!m[2]))return null;
  const start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2]));
  const end=m[1]?(m[2]?Math.min(size-1,Number(m[2])):size-1):size-1;
  return start<=end&&start<size?{start,end}:null;
}
export function createSyncServer({root=path.resolve(here,'../cut-room'),readSource,intervalMs=15000}={}) {
  let source=null,revision=null,lastSuccess=null,error='Checking GitHub…',busy=false;
  const refresh=async()=>{if(busy)return;busy=true;try{
    const update=await readSource(revision);
    if(update){if(!Array.isArray(update.source?.scenes)||new Set(update.source.scenes.map(s=>s.id)).size!==update.source.scenes.length)throw Error('Invalid source');source=update.source;revision=update.revision;}
    lastSuccess=new Date().toISOString();error=null;
  }catch{error='GitHub sync unavailable. Keeping the last loaded storyboard. Check gh auth status on this PC.';}finally{busy=false;}};
  const send=(res,body,type='application/json')=>{res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(typeof body==='string'?body:JSON.stringify(body));};
  const server=http.createServer((req,res)=>{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
    let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}
    if(name==='/api/storyboard-sync')return send(res,{revision,lastSuccess,error,scenes:source?.scenes.filter(s=>s.completedDelivery?.selectedForStoryboard).map(s=>({id:s.id,title:s.title,status:s.status,delivery:s.completedDelivery}))||[]});
    if(name==='/storyboard-sync-client.js')return send(res,fs.readFileSync(path.join(here,'storyboard-sync-client.js'),'utf8'),'text/javascript');
    if(name==='/')name='/storyboard.html';
    const file=safeFile(root,name);if(!file){res.writeHead(404);return res.end('Not found');}
    if(name==='/board.json')return send(res,mergeBoard(JSON.parse(fs.readFileSync(file,'utf8')),source));
    if(name==='/story.json'&&source){const original=JSON.parse(fs.readFileSync(file,'utf8'));return send(res,mergeBoard(original,source));}
    if(/\.html$/.test(name))return send(res,fs.readFileSync(file,'utf8')+'\n<script src="/storyboard-sync-client.js"></script>','text/html; charset=utf-8');
    const size=fs.statSync(file).size;
    const type={'.mp4':'video/mp4','.wav':'audio/wav','.mp3':'audio/mpeg','.jpg':'image/jpeg','.png':'image/png','.json':'application/json','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream';
    const headers={'Content-Type':type,'Cache-Control':'no-store','Accept-Ranges':'bytes'};
    let range;if(req.headers.range){range=byteRange(req.headers.range,size);if(!range){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}Object.assign(headers,{'Content-Range':`bytes ${range.start}-${range.end}/${size}`,'Content-Length':range.end-range.start+1});}else headers['Content-Length']=size;
    res.writeHead(range?206:200,headers);if(req.method==='HEAD')return res.end();fs.createReadStream(file,range||{}).pipe(res);
  });
  const timer=setInterval(refresh,intervalMs);timer.unref();server.on('close',()=>clearInterval(timer));
  return {server,refresh};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const repo=process.env.STORYBOARD_SOURCE_REPO||'namesrexx-design/bizbox';
 const branch=process.env.STORYBOARD_SOURCE_BRANCH||'codex/video-storyboard-reference-hub';
 const sourcePath='docs/video-production/scene-board/storyboard.json';
 const gh=async(args)=>(await exec('gh',args,{timeout:20000,maxBuffer:16*1024*1024,windowsHide:true})).stdout;
 const readSource=async(previous)=>{
  const commit=JSON.parse(await gh(['api',`repos/${repo}/commits/${encodeURIComponent(branch)}`])).sha;
  if(previous===commit)return null;
  const raw=await gh(['api',`repos/${repo}/contents/${sourcePath}?ref=${commit}`,'-H','Accept: application/vnd.github.raw+json']);
  return {revision:commit,source:JSON.parse(raw)};
 };
 const {server,refresh}=createSyncServer({readSource});
 server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port 4321 is occupied. Stop the existing Cut Room server, then start this one.':e.message);process.exitCode=1;});
 server.listen(Number(process.env.CUT_ROOM_PORT||4321),'127.0.0.1',()=>{console.log('Auto-sync storyboard: http://127.0.0.1:'+(process.env.CUT_ROOM_PORT||4321)+'/storyboard.html');refresh();});
}
