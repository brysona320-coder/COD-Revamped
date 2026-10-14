// All sounds are generated at runtime — no copyrighted samples or network assets.
export class AudioSystem {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private ambience?: {tone: OscillatorNode; gain: GainNode};
  private shotNoise?: AudioBuffer;
  constructor(private volume: number) {}
  setVolume(v: number): void { this.volume = v; if (this.output) this.output.gain.value = v; }
  private get(): AudioContext | null {
    if (this.volume <= 0) return null;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume();
      if (!this.output) { this.output = this.context.createGain(); this.output.gain.value = this.volume;this.output.connect(this.context.destination); }
      return this.context;
    } catch { return null; }
  }
  tone(freq:number,end:number,duration:number,level=.15,type:OscillatorType='sawtooth'):void {
    const ctx=this.get();if(!ctx||!this.output)return;
    const t=ctx.currentTime, osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(Math.max(30,end),t+duration);
    gain.gain.setValueAtTime(Math.max(.001,level),t);gain.gain.exponentialRampToValueAtTime(.001,t+duration);
    osc.connect(gain);gain.connect(this.output);osc.start(t);osc.stop(t+duration+.01);
  }
  private noise(ctx:AudioContext):AudioBuffer {
    if(this.shotNoise)return this.shotNoise;
    const buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.42),ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++){
      const t=i/data.length;
      data[i]=(Math.random()*2-1)*Math.exp(-8*t);
    }
    return this.shotNoise=buffer;
  }
  fire(sidearm=false):void {
    const ctx=this.get();if(!ctx||!this.output)return;
    const now=ctx.currentTime;
    // Original procedural transients combine synthetic metallic snap, lower impact and air hiss.
    const noise=ctx.createBufferSource();noise.buffer=this.noise(ctx);
    const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=sidearm?1400:930;filter.Q.value=.65;
    const envelope=ctx.createGain();envelope.gain.setValueAtTime(sidearm?.26:.34,now);
    envelope.gain.exponentialRampToValueAtTime(.0001,now+(sidearm?.18:.23));
    noise.connect(filter);filter.connect(envelope);envelope.connect(this.output);
    noise.start(now);noise.stop(now+.24);
    this.tone(sidearm?470:205,sidearm?145:52,sidearm?.12:.22,sidearm?.105:.17,'sawtooth');
    this.tone(sidearm?1100:830,220,.053,sidearm?.036:.025,'triangle');
  }
  startAmbience():void {
    const ctx=this.get();if(!ctx||!this.output||this.ambience)return;
    const tone=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
    tone.type='sine';tone.frequency.value=54;filter.type='lowpass';filter.frequency.value=130;
    gain.gain.value=.00001;tone.connect(filter);filter.connect(gain);gain.connect(this.output);
    tone.start();gain.gain.setTargetAtTime(.026,ctx.currentTime,.65);
    this.ambience={tone,gain};
  }
  stopAmbience():void {
    if(!this.ambience||!this.context)return;
    const {tone,gain}=this.ambience;gain.gain.setTargetAtTime(.00001,this.context.currentTime,.15);
    tone.stop(this.context.currentTime+1);this.ambience=undefined;
  }
  hit():void {this.tone(1020,680,.09,.09,'triangle');}
  eliminate():void {this.tone(440,880,.20,.17,'sine');this.tone(660,1120,.22,.07,'triangle');}
  reload():void {this.tone(160,280,.12,.055,'square');}
  hurt():void {this.tone(160,50,.20,.095,'triangle');}
  click():void {this.tone(430,300,.08,.025,'sine');}
  dispose():void {this.stopAmbience();if(this.context)void this.context.close();this.context=null;this.output=null;this.shotNoise=undefined;}
}
