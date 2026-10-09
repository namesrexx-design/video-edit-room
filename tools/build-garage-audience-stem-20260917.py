#!/usr/bin/env python3
"""Build the audience-only stem; full assembly remains tools/render-cut.mjs."""
import argparse, json, hashlib, subprocess
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
from scipy.ndimage import maximum_filter1d, gaussian_filter1d
SR=48000
TOTAL=3070*2000
p=argparse.ArgumentParser()
p.add_argument('--raw',required=True);p.add_argument('--base',required=True);p.add_argument('--out',required=True)
a=p.parse_args(); raw=Path(a.raw); out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
def decode(path):
    b=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-ar',str(SR),'-ac','2','-'])
    return np.frombuffer(b,dtype=np.float32).reshape(-1,2).copy()
def level(x,db):
    rms=np.sqrt(np.mean(x*x,axis=1))
    active=rms[rms>max(rms.max()*.04,1e-5)]
    power=np.sqrt(np.mean(active*active)) if len(active) else 1
    return x*10**(db/20)/max(power,1e-7)
def fade(x,attack=.035,release=.18):
    x=x.copy();n=len(x);n1=min(round(attack*SR),n);n2=min(round(release*SR),n)
    if n1:x[:n1]*=np.linspace(0,1,n1)[:,None]
    if n2:x[-n2:]*=np.linspace(1,0,n2)[:,None]
    return x
def source(id,start,dur):
    x=decode(raw/(id+'.mp3'))
    x=x[round(start*SR):round((start+dur)*SR)]
    x=sosfilt(butter(2,[110,7200],btype='bandpass',fs=SR,output='sos'),x,axis=0)
    return x
def pad(x,n):
    return np.pad(x,((0,max(0,n-len(x))),(0,0)))[:n]
def save(name,x):
    # Float input avoids clipping MP3 decoder overshoots before level adjustment.
    assert np.max(abs(x))<.94, (name,float(np.max(abs(x))))
    wavfile.write(out/name,SR,x.astype(np.float32))
# Three performances, two voice identities, staggered timing and placement.
group=np.zeros((round(2.5*SR),2))
voices=[('opjAbZmtig0Y7XRptTw0',.04,1.18,0,-.4),
        ('JYuhfgwdrinPtDdK9zwg',.10,1.10,.07,.4),
        ('etpdkas68yU94Z6UfdA0',0,1.84,.025,0)]
for id,trim,dur,delay,pan in voices:
    x=source(id,trim,dur).mean(axis=1)
    x=np.column_stack((x*np.sqrt((1-pan)/2),x*np.sqrt((1+pan)/2)))
    x=fade(level(x,-31),.015,.17);at=round(delay*SR)
    group[at:at+len(x)]+=x
laugh=fade(level(source('ffwapDwNoE4Ui1pdnJHt',.05,1.55),-31),.12,.55)
group[round(.73*SR):round(.73*SR)+len(laugh)]+=laugh
group=fade(level(group,-27),.02,.3)
save('GARAGE-DREAM-GROUP-WHISPER-LAUGH.wav',group)
base=pad(decode(a.base),TOTAL)
# Smooth ducking based on the actual soundtrack; never change the approved base.
blocks=base[:TOTAL//480*480].reshape(-1,480,2)
rms=np.sqrt(np.mean(blocks*blocks,axis=(1,2)))
db=20*np.log10(rms+1e-9)
activity=np.clip((db+39)/12,0,1)
activity=gaussian_filter1d(maximum_filter1d(activity,size=15),2)
duck=np.repeat(10**(-12*activity/20),480)
duck=np.pad(duck,(0,TOTAL-len(duck)),mode='edge')
spec=[
 dict(id='stakes-concern',frame=534,frames=14,source='jKq0D7n7UiaanfMewqgL',trim=0,db=-31,release=.16,duck=True,beat='Concern after the line about Marge leaving'),
 dict(id='garage-surprise',frame=995,frames=24,source='vXTcDi3CRVvaiJSicL69',trim=.06,db=-27,release=.30,duck=True,beat='Surprise at the garage reveal, under the explanation'),
 dict(id='recliner-chuckle',frame=1266,frames=40,source='ffwapDwNoE4Ui1pdnJHt',trim=.05,db=-25,release=.45,duck=True,beat='Amusement at Homer finding his recliner'),
 dict(id='bugatti-question-chuckle',frame=1384,frames=19,source='J5xLrbWHTA9CJizWu7yV',trim=.10,db=-28,release=.28,duck=True,beat='Knowing chuckle after the Bugatti question; ends before sleepy whispers'),
 dict(id='group-whisper-then-laugh',frame=1875,frames=33,source='GROUP',trim=0,db=-26,release=.24,duck=False,beat='Three audience performances whisper A Bugatti and chuckle after the wake line'),
 dict(id='final-payoff-laugh',frame=3002,frames=66,source='oAKlGkhVTj41oEaVedSL',trim=0,db=-21,release=.72,duck=False,beat='Largest laugh and sparse claps after Blood and visible upward look'),
]
stem=np.zeros((TOTAL,2))
for s in spec:
    n=s['frames']*2000;start=s['frame']*2000
    x=group[:n].copy() if s['source']=='GROUP' else source(s['source'],s['trim'],n/SR)
    x=fade(level(pad(x,n),s['db']),.035,s['release'])
    if s['duck']:x*=duck[start:start+n,None]
    stem[start:start+n]+=x
    s['start_seconds']=s['frame']/24;s['end_seconds']=(s['frame']+s['frames'])/24
    s['peak_dbfs']=float(20*np.log10(np.max(abs(x))+1e-9))
    s['source_sha256']=hashlib.sha256((out/'GARAGE-DREAM-GROUP-WHISPER-LAUGH.wav').read_bytes() if s['source']=='GROUP' else (raw/(s['source']+'.mp3')).read_bytes()).hexdigest()
save('GARAGE-DREAM-AUDIENCE-STEM-20260917.wav',stem)
mixed=base+stem
save('GARAGE-DREAM-AUDIENCE-MIX-QC.wav',mixed)
receipt={'base_sha256':hashlib.sha256(Path(a.base).read_bytes()).hexdigest(),'sample_rate':SR,'samples':TOTAL,'frames':3070,'cues':spec,'whisper_performances':voices,'stem_sha256':hashlib.sha256((out/'GARAGE-DREAM-AUDIENCE-STEM-20260917.wav').read_bytes()).hexdigest(),'mix_sample_peak_dbfs':float(20*np.log10(np.max(abs(mixed)))),'notes':['Base dialogue/music/SFX unchanged.','No crop, timing change, greeting reaction or continuous audience bed.','ASR verifies whispered wording but cannot certify nonverbal quality or a listening pass.']}
(out/'AUDIENCE-EMOTIONS-CUE-RECEIPT-20260917.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
