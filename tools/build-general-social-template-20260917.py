from pathlib import Path
import json,base64,subprocess,os,math,shutil
from PIL import ImageFont
from xml.sax.saxutils import escape
P=Path(__file__).resolve().parents[1]
C=json.loads((P/'source/config.json').read_text())
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
SHARP=Path(os.getenv('CODEX_PRIMARY_RUNTIME_NODE_MODULES','/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules'))/'sharp'
PHOTO='data:image/png;base64,'+base64.b64encode((P/'references/CENTERED-PHOTO-TEMPLATE.png').read_bytes()).decode()
TEAL='#073B42';CREAM='#F6F2E9';YELLOW='#F2ED36'
def run(args):return subprocess.run(list(map(str,args)),check=True,capture_output=True,text=True)
def wrap(s,size,w):
 f=ImageFont.truetype(FONT,size);rows=[];cur=''
 for word in s.split():
  test=(cur+' '+word).strip()
  if cur and f.getlength(test)>w:rows.append(cur);cur=word
  else:cur=test
 if cur:rows.append(cur)
 return rows
def txt(s,y,size=72,w=916,color=CREAM,maxh=None):
 rows=wrap(s,size,w)
 while maxh and len(rows)*size*1.15>maxh:
  size-=2;rows=wrap(s,size,w)
 return ''.join(f'<text x="540" y="{y+i*size*1.15:.1f}" text-anchor="middle" font-family="DejaVu Sans" font-weight="700" font-size="{size}" fill="{color}">{escape(t)}</text>' for i,t in enumerate(rows))
def picture(y=100,w=1000):return f'<image x="{(1080-w)/2}" y="{y}" width="{w}" height="{w*1.25}" preserveAspectRatio="xMidYMid meet" xlink:href="{PHOTO}"/>'
def save(body,path,w=1080,h=1350):
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}">{body}</svg>')
 run(['node','-e',"require(process.argv[1])(process.argv[2],{limitInputPixels:false}).png().toFile(process.argv[3]);",SHARP,path,path.with_suffix('.png')])
def card(a,body,i=None):
 v=f'<rect width="1080" height="1350" fill="{TEAL}"/>'+picture()
 v+='<rect x="504" y="52" width="72" height="7" rx="3" fill="#F2ED36"/>'
 v+=txt(body,138,78,maxh=255)
 if i is not None:v+=f'<text x="986" y="65" text-anchor="end" font-family="DejaVu Sans" font-size="23" font-weight="700" fill="{YELLOW}">{i+1} / 5</text>'
 v+=f'<rect x="0" y="1265" width="1080" height="85" fill="{TEAL}"/>'
 v+=txt(a['cta'],1300,29,975,YELLOW)
 return v
def cards():
 for a in C['angles']:
  save(card(a,a['hook']),P/'cards'/f'POST-{a["id"]}-{a["slug"]}.svg')
  for i,t in enumerate(a['cards']):save(card(a,t,i),P/'carousels'/a['slug']/f'{i+1:02d}.svg')
def motion():
 a=C['angles'][0];tim=json.loads((P/'audio/timing.json').read_text());dur=math.ceil((tim['duration']+1.2)*24)/24;frames=round(dur*24)
 base=f'<rect width="1080" height="1920" fill="{TEAL}"/>'+picture(570,1080)
 base+='<rect x="504" y="108" width="72" height="7" rx="3" fill="#F2ED36"/>'
 save(base,P/'source/motion-base.svg',1080,1920)
 # Native text scrolls within a viewport above the fixed portrait.
 col='';step=575
 for i,s in enumerate(a['segments']):col+=txt(s,150+step*i,70,920,maxh=370)
 save(col,P/'source/motion-column.svg',1080,step*5)
 changes=[x+.35 for x in tim['starts'][1:]]
 terms='+'.join(f'{step}*clip((t-{max(0,x-.22):.5f})/.30,0,1)' for x in changes)
 fg=f'[1:v]format=rgba[col];color=c={TEAL}:s=1080x570:r=24:d={dur}[win];[win][col]overlay=x=0:y=\'-({terms})\':eval=frame:shortest=1[txt];[0:v][txt]overlay=0:150:shortest=1,format=yuv420p[v]'
 proj=P/'render-project';md=proj/'projects/garage-dream/deliveries/CONTENT';md.mkdir(parents=True,exist_ok=True)
 run(['ffmpeg','-v','error','-y','-loop','1','-framerate','24','-i',P/'source/motion-base.png','-loop','1','-framerate','24','-i',P/'source/motion-column.png','-filter_complex_threads','1','-filter_complex',fg,'-map','[v]','-frames:v',frames,'-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-movflags','+faststart',md/'GENERAL-PILE-PICTURE.mp4'])
 run(['ffmpeg','-v','error','-y','-i',P/'audio'/f'{tim["generationId"]}.mp3','-af',f'loudnorm=I=-18:TP=-2:LRA=8,adelay=350|350,apad,atrim=duration={dur}','-ar','48000','-ac','2','-c:a','pcm_s24le',md/'GENERAL-PILE-VOICE.wav'])
 name='GENERAL-PILE-SCROLL-V3-20260917';u='general-pile'
 cut={'format':2,'name':name,'savedAt':'2026-09-17T00:00:00Z','output':{'width':1080,'height':1920},'note':'General reusable content template, centered portrait, no title/name labels. One complete namesrexx eleven_v3 take.','v1':[{'id':u,'u':u,'scene':'GENERAL','folder':'repo-deliveries','file':'CONTENT/GENERAL-PILE-PICTURE.mp4','start':0,'end':frames,'mute':True}],'v2':[],'a2':[{'id':u+'-audio','u':u+'-audio','link':u,'folder':'repo-deliveries','file':'CONTENT/GENERAL-PILE-VOICE.wav','start':0,'end':frames,'at':0,'gain':0}]}
 cp=proj/'projects/garage-dream/cuts'/f'{name}.json';cp.parent.mkdir(parents=True,exist_ok=True);cp.write_text(json.dumps(cut,indent=2)+'\n')
 if os.getenv('PREPARE_ONLY')!='1':
  subprocess.run(['node','tools/render-cut.mjs',str(cp),name],cwd=proj,check=True)
  shutil.copy2(proj/'projects/garage-dream/renders'/f'{name}.mp4',P/'scrolls'/f'{name}.mp4')
 print('PREPARED',name,frames,flush=True)
if __name__=='__main__':
 if os.getenv('MOTION_ONLY')=='1':motion()
 else:cards()
