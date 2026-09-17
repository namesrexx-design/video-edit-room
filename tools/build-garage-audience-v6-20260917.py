#!/usr/bin/env python3
"""Remove stairs nature; rebuild a steady light bird bed from full98s to end."""
from pathlib import Path
import argparse,subprocess,json,hashlib
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter,sosfilt
from scipy.ndimage import gaussian_filter1d
p=argparse.ArgumentParser();p.add_argument('--workspace',type=Path,default=Path.cwd());root=p.parse_args().workspace.resolve()
v5=root/'homer-sync/audience-v5';out=root/'homer-sync/audience-v6';sr=48000
def decode(p):return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-ar','48000','-ac','2','-f','f32le','-']),np.float32).reshape(-1,2).copy()
_,old=wavfile.read(v5/'GARAGE-DREAM-FULL-AUDIO-V5.wav');_,oldnature=wavfile.read(v5/'EXTERIOR-NATURE-STEM.wav');_,v4=wavfile.read(root/'homer-sync/audience-v4/GARAGE-DREAM-FULL-AUDIO-V4.wav')
full=old.copy();nature=oldnature.copy();stairs=(10*sr,round(13.291667*sr));late=round(94.708333*sr);start=98*sr;total=len(full)
# Exact pre-nature audio for stairs. Retain earlier car/driveway cues unchanged.
full[stairs[0]:stairs[1]]=v4[stairs[0]:stairs[1]];nature[stairs[0]:stairs[1]]=0
# Remove only the prior late nature stem, retaining dialogue, horn, cheer and laughter.
core=(old[late:].astype(np.float64)-oldnature[late:].astype(np.float64)).astype(np.float32)
full[late:]=core;nature[late:]=0
ids=['RjQncgx66pZeBRj7Gq23','2znDf3MVNhZnixwWzUvi','AAKwsY2TqDDPVUzjZd4z'];clips=[]
for i in ids:
 x=decode(v5/'raw'/(i+'.mp3'));x=sosfilt(butter(2,[140,9000],btype='bandpass',fs=sr,output='sos'),x,axis=0)
 x*=10**(-38/20)/np.sqrt(np.mean(x*x));clips.append(x)
n=total-start;bed=np.zeros((n+8*sr,2));overlap=round(.6*sr);pos=0;k=0
while pos<n:
 x=clips[k%len(clips)].copy();x[:overlap]*=np.sin(np.linspace(0,np.pi/2,overlap))[:,None];x[-overlap:]*=np.cos(np.linspace(0,np.pi/2,overlap))[:,None]
 bed[pos:pos+len(x)]+=x;pos+=len(x)-overlap;k+=1
bed=bed[:n]
# Gently level quiet stretches in the recordings too, preserving individual bird calls.
block=480;count=n//block;power=np.mean(bed[:count*block].reshape(count,block,2)**2,axis=(1,2))
smooth_power=gaussian_filter1d(power,150)
gain=np.clip(10**(-38/20)/np.sqrt(smooth_power+1e-12),.5,2.5)
gain=gaussian_filter1d(gain,50)
envelope=np.interp(np.arange(n),np.arange(count)*block+block/2,gain)
bed*=envelope[:,None]
fadeout=round(.18*sr);bed[-fadeout:]*=np.linspace(1,0,fadeout)[:,None]
# No dialogue-dependent level pumping or reduced reference-shot section in this bed.
nature[start:]=bed;full[start:]+=bed.astype(np.float32)
assert total==3334*2000 and np.max(abs(full))<.94
mask=np.ones(total,bool);mask[stairs[0]:stairs[1]]=False;mask[late:]=False
levels=[]
for a,b in [(98.6,110),(110,122),(122,134),(134,total/sr-.18)]:
 x=nature[round(a*sr):round(b*sr)];levels.append({'start':a,'end':b,'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(x*x))+1e-12))})
assert abs(levels[2]['rms_dbfs']-levels[1]['rms_dbfs'])<2
assert abs(levels[3]['rms_dbfs']-levels[1]['rms_dbfs'])<2
checks={'stairs_exact_pre_nature_soundtrack':bool(np.array_equal(full[stairs[0]:stairs[1]],v4[stairs[0]:stairs[1]])),'other_early_audio_unchanged':bool(np.array_equal(full[mask],old[mask])),'no_new_late_nature_before_98':bool(np.max(abs(nature[late:start]))==0),'late_existing_mix_preserved':bool(np.allclose(full[late:]-nature[late:],core,atol=7e-8))}
assert all(checks.values())
for name,x in [('GARAGE-DREAM-FULL-AUDIO-V6.wav',full),('EXTERIOR-NATURE-STEM-V6.wav',nature)]:wavfile.write(out/name,sr,x.astype(np.float32))
receipt={'frames':3334,'seconds':total/sr,'stairs_nature_removed_full_seconds':[10,13.291667],'late_nature_full_seconds':[98,total/sr],'late_nature_nominal_rms_dbfs':-38,'dialogue_ducking_on_late_nature':False,'previous_reference_shot_level_dip_removed':True,'final_release_seconds':.18,'nature_sources':ids,'nature_level_measurements':levels,'checks':checks,'peak_dbfs':float(20*np.log10(np.max(abs(full)))),'audio_sha256':hashlib.sha256((out/'GARAGE-DREAM-FULL-AUDIO-V6.wav').read_bytes()).hexdigest()}
(out/'AUDIO-V6-CUE-RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
