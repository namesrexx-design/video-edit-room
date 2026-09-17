#!/usr/bin/env python3
"""Native text layouts over the unchanged approved still; source motion + canonical cuts.

No generative image/video model. SVG keeps typography editable and the supplied
photograph intact. Final MP4 assembly uses tools/render-cut.mjs.
"""
from pathlib import Path
import base64, json, os, re, subprocess, math, hashlib, shutil
from xml.sax.saxutils import escape
from PIL import ImageFont

ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'source/campaign.json').read_text())
BG=ROOT/'references/LYFE-readings-background-3840.png'
INK='#F6F2E9'; TEAL='#073B42'; ACCENT='#F2ED36'; MUTED='#8DC7C9'
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
SHARP=Path(os.environ.get('CODEX_PRIMARY_RUNTIME_NODE_MODULES','/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules'))/'sharp'
PHOTO='data:image/png;base64,'+base64.b64encode(BG.read_bytes()).decode()
def run(args):return subprocess.run(list(map(str,args)),check=True,capture_output=True,text=True)
def lines(s,size,width):
 f=ImageFont.truetype(FONT,size); out=[];cur=''
 for word in s.split():
  test=(cur+' '+word).strip()
  if cur and f.getlength(test)>width:out.append(cur);cur=word
  else:cur=test
 if cur:out.append(cur)
 return out
def text(s,x,y,size=64,width=900,color=INK,leading=1.19):
 ls=lines(s,size,width)
 return ''.join(f'<text x="{x}" y="{y+i*size*leading:.2f}" font-family="DejaVu Sans" font-weight="700" font-size="{size}" fill="{color}">{escape(v)}</text>' for i,v in enumerate(ls))
def svg(body,w,h):return f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{body}</svg>'
def bitmap(y,w=1080):return f'<image x="0" y="{y}" width="{w}" height="{w/2}" preserveAspectRatio="xMidYMid meet" xlink:href="{PHOTO}"/>'
def save_svg(body,path,w,h):
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(svg(body,w,h))
 run(['node','-e',"const sharp=require(process.argv[1]);sharp(process.argv[2],{limitInputPixels:false}).png().toFile(process.argv[3]);",SHARP,path,path.with_suffix('.png')])
def plate(title,h=1350,subtitle='GARAGE DREAM  /  REXX'):
 return f'<rect width="1080" height="{h}" fill="{TEAL}"/>'+bitmap(h-540)+text(subtitle,80,105,29,920,MUTED)+f'<rect x="80" y="148" width="118" height="8" fill="{ACCENT}"/>'
def emit_cards(s):
 d=ROOT/'carousels'/f'{s["id"]}-{s["slug"]}';short=s['carousel']
 for i,body in enumerate(short):
  label='SWIPE FOR THE SIGNS' if i==0 else ('SEND THIS TO YOUR PERSON' if i==4 else f'SIGN {i} / 3')
  content=plate(s['title'])+text(label,80,221,26,920,ACCENT)
  size=76 if i==0 else (63 if i==4 else 70)
  content+=text(body,80,340,size,905)
  content+=text(f'{i+1:02d} / 05',858,100,25,145,ACCENT)
  save_svg(content,d/f'{i+1:02d}.svg',1080,1350)
 pbody=plate(s['title'])+text('THIS REMINDS ME OF...',80,221,27,920,ACCENT)+text(s['photoHeadline'],80,344,79,910)+text(s['photoCTA'],80,646,37,905,MUTED)
 save_svg(pbody,ROOT/'photo-posts'/f'PHOTO-{s["id"]}-{s["slug"]}.svg',1080,1350)
def emit_motion(s):
 d=ROOT/'source'/f'SCROLL-{s["id"]}';d.mkdir(exist_ok=True)
 title=s['title'];dur=s['frames']/24
 base=plate(title,1920)+text(s['seriesLabel'].upper(),80,253,34,900,ACCENT)
 base+=text('A FEW SIGNS YOU KNOW THE PERSON.',80,330,24,915,MUTED)
 base+=text('LYFE  /  GARAGE DREAM',80,1832,27,900,MUTED)
 base+='<rect x="80" y="1120" width="880" height="2" fill="#33777D"/>'
 save_svg(base,d/'base.svg',1080,1920)
 # A tall native text column moves upward at the spoken paragraph boundaries.
 # Only the text viewport is clipped. The approved photograph stays fully visible.
 step=630; body=''
 for i,seg in enumerate(s['segments']):
  body+=text('THE SETUP' if i==0 else ('YOUR PERSON?' if i==4 else f'{i:02d}'),0,i*step+52,30,880,ACCENT)
  body+=text(seg,0,i*step+160,65 if i<4 else 59,880)
 save_svg(body,d/'column.svg',880,step*5)
 starts=[max(0,x+s['voiceOffsetSeconds']-.12) for x in s['displayStarts']]
 terms=[f'{step}*clip((t-{max(0,t-.25):.5f})/0.30,0,1)' for t in starts[1:]]
 offset='+'.join(terms)
 fg=(f"[1:v]format=rgba[col];color=c={TEAL}:s=880x650:r=24:d={dur}[win];"
     f"[win][col]overlay=x=0:y='-({offset})':eval=frame:shortest=1[txt];"
     f"[0:v][txt]overlay=80:425:shortest=1,format=yuv420p[v]")
 proj=ROOT/'render-project';media=proj/'projects/garage-dream/deliveries/CONTENT';media.mkdir(parents=True,exist_ok=True)
 source=media/f'SCROLL-{s["id"]}-PICTURE.mp4'
 run(['ffmpeg','-v','error','-y','-loop','1','-framerate','24','-i',d/'base.png','-loop','1','-framerate','24','-i',d/'column.png','-filter_complex',fg,'-map','[v]','-frames:v',s['frames'],'-an','-c:v','libx264','-preset','fast','-crf','18','-movflags','+faststart',source])
 # One complete V3 take per script. No internal cuts or time stretching.
 raw=ROOT/'audio/raw'/f'{s["generationId"]}.mp3';voice=media/f'SCROLL-{s["id"]}-VOICE.wav'
 run(['ffmpeg','-v','error','-y','-i',raw,'-af',f'loudnorm=I=-18:TP=-2:LRA=8,adelay=350|350,apad,atrim=duration={dur}','-ar','48000','-ac','2','-c:a','pcm_s24le',voice])
 shutil.copy2(voice,ROOT/'audio'/f'REXX-V3-{s["id"]}-{s["slug"]}.wav')
 name=f'SCROLL-{s["id"]}-{s["slug"]}-REXX-V3-20260917';u='scroll-'+s['id']
 cut={'format':2,'name':name,'savedAt':'2026-09-17T00:00:00Z','output':{'width':1080,'height':1920},'note':'Existing approved LYFE still with native scrolling text; one continuous namesrexx eleven_v3 take. No regenerated characters or scenes.','v1':[{'id':u,'u':u,'scene':s['id'],'folder':'repo-deliveries','file':f'CONTENT/{source.name}','start':0,'end':s['frames'],'mute':True}],'v2':[],'a2':[{'id':u+'-voice','u':u+'-voice','link':u,'folder':'repo-deliveries','file':f'CONTENT/{voice.name}','start':0,'end':s['frames'],'at':0,'gain':0}]}
 cp=proj/'projects/garage-dream/cuts'/f'{name}.json';cp.parent.mkdir(parents=True,exist_ok=True);cp.write_text(json.dumps(cut,indent=2)+'\n')
 (ROOT/'source'/f'{name}.json').write_text(json.dumps(cut,indent=2)+'\n')
 print('PREPARED',name,flush=True)
 if os.environ.get('PREPARE_ONLY')!='1':
  subprocess.run(['node','tools/render-cut.mjs',str(cp),name],cwd=proj,check=True)
  rendered=proj/'projects/garage-dream/renders'/f'{name}.mp4'
  shutil.copy2(rendered,ROOT/'scrolls'/rendered.name)
  print('FINAL',rendered.name,hashlib.sha256(rendered.read_bytes()).hexdigest(),flush=True)
if __name__=='__main__':
 for folder in ['carousels','photo-posts','scrolls','audio']:(ROOT/folder).mkdir(exist_ok=True)
 for s in DATA['series']:
  emit_cards(s)
  if os.environ.get('CARDS_ONLY')!='1':emit_motion(s)
