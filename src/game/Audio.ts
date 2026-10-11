// All sounds are generated at runtime — no copyrighted samples or network assets.
export class AudioSystem {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
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
  fire(sidearm=false):void {this.tone(sidearm?580:310,sidearm?115:55,sidearm?.12:.18,sidearm?.1:.15,'sawtooth');}
  hit():void {this.tone(1020,680,.09,.09,'triangle');}
  eliminate():void {this.tone(440,880,.20,.17,'sine');this.tone(660,1120,.22,.07,'triangle');}
  reload():void {this.tone(160,280,.12,.055,'square');}
  hurt():void {this.tone(160,50,.20,.095,'triangle');}
  click():void {this.tone(430,300,.08,.025,'sine');}
  dispose():void {if(this.context)void this.context.close();this.context=null;this.output=null;}
}
