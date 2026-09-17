#!/usr/bin/env python3
"""Four sleepy whispers, Apu cheer, and low exterior nature ambience."""
from pathlib import Path
import argparse,json,hashlib,subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter,sosfilt
from scipy.ndimage import maximum_filter1d,gaussian_filter1d
p=argparse.ArgumentParser();p.add_argument('--workspace',type=Path,default=Path.cwd());root=p.parse_args().workspace.resolve()
out=root/'homer-sync/audience-v5';sr=48000;total=3334*2000
def decode(p):return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-ar','48000','-ac','2','-f','f32le','-']),np.float32).reshape(-1,2).copy()
def fade(x,a=.02,b=.1):
 x=x.copy();na=min(len(x),round(a*sr));nb=min(len(x),round(b*sr))
 if na:x[:na]*=np.linspace(0,1,na)[:,None]
 if nb:x[-nb:]*=np.linspace(1,0,nb)[:,None]
 return x
def level(x,db):
 r=np.sqrt(np.mean(x*x,axis=1));r=r[r>max(r.max()*.04,1e-7)];rms=np.sqrt(np.mean(r*r))
 return x*10**(db/20)/max(rms,1e-9)
_,original=wavfile.read(root/'homer-sync/audience-v4/GARAGE-DREAM-FULL-AUDIO-V4.wav');base=original.copy()
# Rebuild only the later whisper window from the exact clean Rexx source.
# Correlation found a 16-sample decoder alignment offset; correlation > .99995.
lo=round(70.70*sr);hi=74*sr;clean_end=round((10+1531/24)*sr)
rexx=decode(root/'homer-sync/audio-corrections-v2/S10-T2.mp3')
src_start=round(14.45*sr)+16
clean=np.zeros((hi-lo,2));clean[:clean_end-lo]=rexx[src_start:src_start+clean_end-lo]*10**(2/20)
recording=decode(root/'homer-sync/audio-final-review/recordings/AUD018.mp3')
whispers=[dict(number=2,start_frame=24,end_frame=42,full_at=71.25,gain_db=4),dict(number=3,start_frame=45,end_frame=64,full_at=72.25,gain_db=4),dict(number=4,start_frame=1,end_frame=20,full_at=73+5/24,gain_db=2)]
whisperstem=np.zeros_like(base)
for w in whispers:
 x=recording[w['start_frame']*2000:w['end_frame']*2000]*10**(w['gain_db']/20)
 x=fade(x,.006,.06);a=round(w['full_at']*sr);b=a+len(x)
 assert a>=lo and b<=hi
 clean[a-lo:b-lo]+=x;whisperstem[a:b]+=x;w['full_end']=b/sr
blend=np.ones(hi-lo);blend[:240]=np.linspace(0,1,240)
# Last added whisper fades to zero by 74s; snore starts on the unchanged next sample.
base[lo:hi]=base[lo:hi]*(1-blend[:,None])+clean*blend[:,None]
blocks=base[:total//480*480].reshape(-1,480,2)
db=20*np.log10(np.sqrt(np.mean(blocks*blocks,axis=(1,2)))+1e-9)
activity=gaussian_filter1d(maximum_filter1d(np.clip((db+39)/12,0,1),size=15),2)
def duck(depth):return np.pad(np.repeat(10**(-depth*activity/20),480),(0,total-len(activity)*480),mode='edge')
cheer=np.zeros_like(base);x=decode(root/'homer-sync/audience-v2/raw/MPlcPhuZYqOdXHYttjnP.mp3')[:round(2.65*sr)]
x=sosfilt(butter(2,[110,7500],btype='bandpass',fs=sr,output='sos'),x,axis=0)
x=fade(level(x,-23),.045,.5);a=round(95.55*sr);b=a+len(x);x*=duck(12)[a:b,None];cheer[a:b]=x
ids=['RjQncgx66pZeBRj7Gq23','2znDf3MVNhZnixwWzUvi','AAKwsY2TqDDPVUzjZd4z']
amb=[level(sosfilt(butter(2,[140,9000],btype='bandpass',fs=sr,output='sos'),decode(out/'raw'/(i+'.mp3')),axis=0),-37) for i in ids]
def ambient(n,phase):
 y=np.zeros((n+8*sr,2));pos=0;k=phase
 while pos<n:
  x=fade(amb[k%len(amb)],.6,.6);y[pos:pos+len(x)]+=x;pos+=len(x)-round(.6*sr);k+=1
 return fade(y[:n],.5,.6)
nature=np.zeros_like(base)
ranges=[dict(start=10.0,end=13.291667,scene='Exterior stairs'),dict(start=29.375,end=32.0,scene='Exterior approach to car'),dict(start=40.958333,end=56.041667,scene='Driveway and open garage threshold'),dict(start=94.708333,end=total/sr,scene='Apu arrival and open-window outdoor conversation')]
nduck=duck(6)
for k,r in enumerate(ranges):
 a=round(r['start']*sr);b=min(total,round(r['end']*sr));x=ambient(b-a,k)*nduck[a:b,None]
 nature[a:b]+=x
# Blend lower where the owner's reference shot already contains native nature sound.
env=np.ones(total);a=round(129.5*sr);b=round(133.5*sr);edge=round(.6*sr)
env[a:a+edge]=np.linspace(1,.4,edge);env[a+edge:b-edge]=.4;env[b-edge:b]=np.linspace(.4,1,edge);nature*=env[:,None]
full=base+cheer+nature
assert len(full)==total and np.max(abs(full))<.94
outside=np.ones(total,bool);outside[lo:hi]=False
checks={'base_outside_retimed_whispers_unchanged':bool(np.array_equal(base[outside],original[outside])),'first_sleep_whisper_unchanged':bool(np.array_equal(base[round(68.5*sr):round(69.6*sr)],original[round(68.5*sr):round(69.6*sr)])),'snore_and_dream_base_unchanged':bool(np.array_equal(base[74*sr:87*sr],original[74*sr:87*sr])),'horn_base_unchanged':bool(np.array_equal(base[round(94.49*sr):round(94.97*sr)],original[round(94.49*sr):round(94.97*sr)]))}
assert all(checks.values())
for name,x in [('GARAGE-DREAM-FULL-AUDIO-V5.wav',full),('SLEEP-WHISPERS-2-3-4.wav',whisperstem),('APU-AUDIENCE-CHEER.wav',cheer),('EXTERIOR-NATURE-STEM.wav',nature)]:wavfile.write(out/name,sr,x.astype(np.float32))
receipt={'full_frames':3334,'full_seconds':total/sr,'whisper_1':'Retained exactly at full68.583333s','whispers':whispers,'second_whisper_shift_seconds':.5,'third_whisper_shift_seconds':-.25,'fourth_whisper':'Existing first AUD018 performance reused softer; ends exactly before snore','lip_review':'12fps face frames: closures/rounded opening near71.25/71.42,72.25/72.42,73.21/73.38; first whisper retained. Visual timing and waveform review, not a human listening certification.','clean_rexx_decoder_offset_samples':16,'clean_rexx_alignment_correlation':.999957627,'apu_cheer':{'source':'MPlcPhuZYqOdXHYttjnP','full_start':95.55,'full_end':98.2,'active_dbfs':-23,'dialogue_duck_db':12},'nature':{'sources':ids,'ranges':ranges,'active_dbfs':-37,'dialogue_duck_db':6,'reference_shot_blend':[129.5,133.5]},'checks':checks,'full_peak_dbfs':float(20*np.log10(np.max(abs(full)))),'full_audio_sha256':hashlib.sha256((out/'GARAGE-DREAM-FULL-AUDIO-V5.wav').read_bytes()).hexdigest()}
(out/'AUDIO-V5-CUE-RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
