(()=>{
 const host=document.createElement('section');host.style.cssText='margin:12px auto;padding:14px;max-width:1168px;border:1px solid currentColor;border-radius:10px';
 const title=document.createElement('strong');title.textContent='Finished scene updates';
 const state=document.createElement('p');state.setAttribute('role','status');state.style.fontSize='16px';
 const clips=document.createElement('div');clips.style.cssText='display:flex;flex-wrap:wrap;gap:12px';host.append(title,state,clips);
 const target=document.querySelector('.wrap')||document.body;target.prepend(host);
 let revision=null,pending=null,request=false;
 function safeUrl(src){try{const u=new URL(src);return u.protocol==='https:'?u.href:null;}catch{return null;}}
 function showScenes(scenes){clips.replaceChildren();for(const scene of scenes){const src=safeUrl(scene.delivery.src);if(!src)continue;const card=document.createElement('div');card.style.cssText='flex:1 1 300px;max-width:540px';const heading=document.createElement('h3');heading.textContent=scene.id+' · '+scene.title;const v=document.createElement('video');v.controls=true;v.preload='metadata';v.playsInline=true;v.src=src;v.style.cssText='width:100%;aspect-ratio:16/9;background:#111';const note=document.createElement('p');note.style.fontSize='16px';note.textContent='Complete clip with existing audio · '+(scene.delivery.frames/scene.delivery.fps).toFixed(2)+' s';v.addEventListener('error',()=>{note.textContent='Clip could not load. Open its source to review.';const a=document.createElement('a');a.href=src;a.textContent='Open complete clip';a.target='_blank';a.rel='noopener';note.append(' ',a);},{once:true});card.append(heading,v,note);clips.append(card);}}
 async function apply(data){if(data.error){state.textContent=data.error;return;}if(data.revision===revision){state.textContent='Synced · checks for merged scene updates automatically';return;}
  if([...document.querySelectorAll('video,audio')].some(v=>!v.paused&&!v.ended)||document.querySelector('textarea:focus,input:focus')){pending=data;state.textContent='New scene update ready. It will appear when playback or editing stops.';return;}
  if(typeof loadBoard==='function')await loadBoard();
  showScenes(data.scenes);revision=data.revision;pending=null;state.textContent='Synced · finished clips below include their audio';
 }
 async function poll(){if(request)return;request=true;try{const r=await fetch('/api/storyboard-sync',{cache:'no-store'});if(!r.ok)throw Error();const data=await r.json();await apply(data);}catch{state.textContent='Sync connection unavailable. Current storyboard retained.';}finally{request=false;}}
 state.textContent='Checking for finished scenes…';poll();setInterval(poll,5000);
})();
