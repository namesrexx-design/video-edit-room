#!/usr/bin/env python3
"""Owner's five final audio notes. Canonical video assembly: render-cut.mjs."""
from pathlib import Path
import json, hashlib, subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
from scipy.ndimage import maximum_filter1d, gaussian_filter1d
ROOT=Path(__file__).resolve().parents[2]
OLD=ROOT/'homer-sync/audience-final'
OUT=ROOT/'homer-sync/audience-v2'
SR=48000; TOTAL=3070*2000
def decode(p, filt=None):
    cmd=['ffmpeg','-v','error','-i',str(p)]
    if filt: cmd+=['-af',filt]
    return np.frombuffer(subprocess.check_output(cmd+['-ar',str(SR),'-ac','2','-f','f32le','-']),np.float32).reshape(-1,2).copy()
def fade(x,attack=.012,release=.08):
    x=x.copy(); a=min(len(x),round(attack*SR));b=min(len(x),round(release*SR))
    if a:x[:a]*=np.linspace(0,1,a)[:,None]
    if b:x[-b:]*=np.linspace(1,0,b)[:,None]
    return x
def active_rms(x):
    r=np.sqrt(np.mean(x*x,axis=1)); a=r[r>max(r.max()*.04,1e-5)]
    return np.sqrt(np.mean(a*a)) if len(a) else 1
def level(x,db):return x*10**(db/20)/max(active_rms(x),1e-8)
def get(id,start,dur,new=False,pan=None):
    x=decode((OUT if new else OLD)/'raw'/(id+'.mp3'))[round(start*SR):round((start+dur)*SR)]
    x=sosfilt(butter(2,[110,7200],btype='bandpass',fs=SR,output='sos'),x,axis=0)
    if pan is not None:
        m=x.mean(axis=1);x=np.column_stack([m*np.sqrt((1-pan)/2),m*np.sqrt((1+pan)/2)])
    return x
base=decode(OLD/'base.wav')[:TOTAL]
before=decode(OUT/'before-second-laugh.wav')[:TOTAL]
# Restore only the separately added second laugh. Keep first laugh and following horn.
lo=2018*2000; hi=2032*2000; n=round(.008*SR)
blend=np.ones(hi-lo);blend[:n]=np.linspace(0,1,n);blend[-n:]=np.linspace(1,0,n)
base[lo:hi]=base[lo:hi]*(1-blend[:,None])+before[lo:hi]*blend[:,None]
# One continuous saved-voice take, no internal cuts. Small tempo adjustment fits existing shot.
rexx=decode(OUT/'raw/EwxG9tnXh8Ac2dLtCBL5.mp3','atempo=1.05')
start=round(41.20*SR);end=round(46.04*SR)
target=active_rms(base[round(41.36*SR):round(45.52*SR)])
rexx=fade(rexx*target/max(active_rms(rexx),1e-8),.005,.06)
assert len(rexx)<=end-start
replacement=np.zeros((end-start,2));replacement[:len(rexx)]=rexx
blend=np.ones(end-start);blend[:240]=np.linspace(0,1,240);blend[-480:]=np.linspace(1,0,480)
base[start:end]=base[start:end]*(1-blend[:,None])+replacement*blend[:,None]
blocks=base[:TOTAL//480*480].reshape(-1,480,2)
db=20*np.log10(np.sqrt(np.mean(blocks*blocks,axis=(1,2)))+1e-9)
activity=gaussian_filter1d(maximum_filter1d(np.clip((db+39)/12,0,1),size=15),2)
duck=np.repeat(10**(-12*activity/20),480)
duck=np.pad(duck,(0,TOTAL-len(duck)),mode='edge')
stem=np.zeros((TOTAL,2));cues=[]
def add(name,x,at,db,ducked=True,release=.12):
    x=fade(level(x,db),.012,release);s=round(at*SR);e=min(s+len(x),TOTAL);x=x[:e-s]
    if ducked:x*=duck[s:e,None]
    stem[s:e]+=x
    cues.append(dict(name=name,body_start=at,full_start=at+10,body_end=e/SR,target_active_dbfs=db,ducked=ducked))
# Several audible gasp performances followed by two people whispering Oh no.
for id,trim,dur,at,pan in [('jKq0D7n7UiaanfMewqgL',0,.61,22.25,-.45),('vXTcDi3CRVvaiJSicL69',.06,.61,22.29,.45),('jXnrgy0jRsoSMvO8AavV',.03,.62,22.34,0)]:
    add('group gasp '+id,get(id,trim,dur,pan=pan),at,-31,release=.15)
add('Oh no male',get('kqCSiBnJZVGgGND6kYsv',0,.67,True,-.3),22.83,-27)
add('Oh no female',get('GpFs8Bh6GUALfTwdw07U',0,.83,True,.4),22.90,-29)
add('Hey Homer cheer and applause',get('puyIRpowDVtF43zxKhid',0,3,True),31.75,-23,release=.4)
# Retain the other approved audience beats, ducked against the revised dialogue.
add('garage surprise',get('vXTcDi3CRVvaiJSicL69',.06,1),995/24,-27,release=.30)
add('recliner chuckle',get('ffwapDwNoE4Ui1pdnJHt',.05,40/24),1266/24,-25,release=.45)
add('Bugatti question chuckle',get('J5xLrbWHTA9CJizWu7yV',.1,19/24),1384/24,-28,release=.28)
# Conversational group reaction: question then response. Removes the old A Bugatti cue.
add('Did he say Bugatti lead',get('kqCSiBnJZVGgGND6kYsv',1.10,1.31,True,-.15),78.145,-25,release=.10)
add('Did he say Bugatti background',get('GpFs8Bh6GUALfTwdw07U',1.52,1.50,True,.4),78.17,-34,release=.12)
add('Oh my God response',get('awvKirQscf5koWJqkLlE',3.52,.85,True,.3),79.31,-25,release=.09)
add('final payoff laugh',get('oAKlGkhVTj41oEaVedSL',0,66/24),3002/24,-21,False,.72)
mix=base+stem
intro=decode(OLD/'GARAGE-DREAM-FINAL-AUDIENCE-INTRO-20260917.mp4')[:10*SR]
full=np.concatenate([intro,mix])
assert len(full)==3310*2000
assert np.max(np.abs(full))<.94
for name,x in [('GARAGE-DREAM-REVISED-BASE.wav',base),('GARAGE-DREAM-AUDIENCE-V2-STEM.wav',stem),('GARAGE-DREAM-FULL-AUDIO-V2.wav',full)]:
    wavfile.write(OUT/name,SR,x.astype(np.float32))
receipt=dict(sample_rate=SR,full_frames=3310,body_frames=3070,full_samples=len(full),peak_dbfs=float(20*np.log10(np.max(np.abs(full)))),rexx=dict(voice_id='omTQvsWgoQBrcTuWdttm',generation='EwxG9tnXh8Ac2dLtCBL5',script='Homer, this is like a scene from Storage Wars. You got a Bugatti in here.',body_start=41.20,body_end=41.20+len(rexx)/SR,tempo=1.05,internal_cuts=0),second_laugh_removed=dict(start_body=lo/SR,end_body=hi/SR,method='restore clean pre-addition audio with 8ms edge crossfades'),cues=cues,notes=['All approved picture timing retained. Intro audio copied from prior full master.','ASR checked generated words; automated checks are not a human listening certification.'])
receipt['sources']={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [OLD/'base.wav',OUT/'before-second-laugh.wav',*sorted((OUT/'raw').glob('*.mp3'))]}
receipt['audio_sha256']=hashlib.sha256((OUT/'GARAGE-DREAM-FULL-AUDIO-V2.wav').read_bytes()).hexdigest()
(OUT/'AUDIO-V2-CUE-RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:v for k,v in receipt.items() if k not in ['sources','cues']},indent=2))
