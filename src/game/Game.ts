import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { AudioSystem } from './Audio';
import { Bot } from './Bot';
import { Input, Player } from './Player';
import { World } from './World';
import { Weapon } from './Weapon';
import type { Settings } from './Settings';
import { formatTime, matchOver, MATCH_DURATION, newScore, registerDeath, registerKill, scoreXP, SCORE_LIMIT, type Score } from './Rules';

export interface HudData {
  health:number; ammo:number; reserve:number; weapon:string; reloading:number;
  time:string; kills:number; deaths:number; aiming:boolean; respawn:number; fps:number;
  score:Score; playerX:number; playerZ:number; yaw:number; bots:readonly Bot[];
}
export interface Results { score:Score; xp:number; won:boolean }
export interface Events {
  hud(data:HudData):void;
  elimination(name:string):void;
  damage(amount:number):void;
  hit(kill:boolean):void;
  results(data:Results):void;
  paused():void;
}
interface Trail { line:THREE.Line; duration:number; }
interface Impact { points:THREE.Points; life:number; velocities:THREE.Vector3[]; }
export class Game {
  readonly world=new World();
  readonly renderer:THREE.WebGLRenderer;
  readonly camera:THREE.PerspectiveCamera;
  readonly input:Input;
  readonly player:Player;
  readonly weapon:Weapon;
  readonly audio:AudioSystem;
  readonly bots:Bot[];
  readonly events:Events;
  score:Score=newScore();
  mode:'menu'|'playing'|'paused'|'finished'='menu';
  private settings:Settings;
  private previousFrame=0;
  private hudTimer=0;
  private fps=60;
  private trails:Trail[]=[];
  private impacts:Impact[]=[];
  private composer:EffectComposer|undefined;
  private raycaster=new THREE.Raycaster();
  private animationHandle=0;
  private noise=0;
  constructor(container:HTMLElement,settings:Settings,events:Events){
    this.settings=settings;this.events=events;
    this.renderer=new THREE.WebGLRenderer({antialias:settings.quality!=='low',powerPreference:'high-performance',alpha:false});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.37;
    this.renderer.shadowMap.enabled=settings.quality!=='low';
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.camera=new THREE.PerspectiveCamera(settings.fov,1,.075,180);
    this.camera.rotation.order='YXZ';this.camera.userData.baseFov=settings.fov;
    this.world.scene.add(this.camera);
    this.world.art.setQuality(settings.quality);
    this.configurePostProcessing();
    this.audio=new AudioSystem(settings.volume);
    this.player=new Player(this.camera,this.world.colliders);
    this.weapon=new Weapon(this.camera,this.audio);
    this.bots=[0,1,2,3,4].map(i=>new Bot(i,this.world));
    this.input=new Input(this.renderer.domElement);
    this.input.setEnabled(false);
    this.input.onUnlock=()=>{if(this.mode==='playing')this.pause();};
    window.addEventListener('resize',this.resize);
    this.resize();
    this.camera.position.set(27,18,41);this.camera.lookAt(0,3,0);
    this.previousFrame=performance.now();this.animationHandle=requestAnimationFrame(this.frame);
  }
  private configurePostProcessing():void {
    this.composer?.dispose();this.composer=undefined;
    if(this.settings.quality!=='high')return;
    this.composer=new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.world.scene,this.camera));
    const bloom=new UnrealBloomPass(new THREE.Vector2(window.innerWidth,window.innerHeight),.32,.4,1.17);
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());
  }
  private resize=():void=>{
    const width=window.innerWidth,height=window.innerHeight;
    this.renderer.setSize(width,height,false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,this.settings.quality==='high'?2:this.settings.quality==='medium'?1.4:1));
    this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
    this.composer?.setPixelRatio(Math.min(window.devicePixelRatio||1,1.4));
    this.composer?.setSize(width,height);
  };
  applySettings(settings:Settings):void{
    this.settings=settings;this.camera.userData.baseFov=settings.fov;
    this.camera.fov=settings.fov;this.camera.updateProjectionMatrix();this.audio.setVolume(settings.volume);
    this.renderer.shadowMap.enabled=settings.quality!=='low';
    this.world.art.setQuality(settings.quality);
    this.configurePostProcessing();this.resize();
  }
  start():void{
    this.score=newScore();this.mode='playing';this.hudTimer=0;this.noise=0;
    this.player.yaw=0;this.player.place(new THREE.Vector3(0,0,33));
    for(const bot of this.bots) bot.respawn();
    this.weapon.reset();this.input.clear();this.input.setEnabled(true);this.input.lock();
    this.audio.startAmbience();this.audio.click();this.pushHud();
  }
  resume():void{if(this.mode!=='paused')return;this.mode='playing';this.input.setEnabled(true);this.input.lock();}
  pause():void{if(this.mode!=='playing')return;this.mode='paused';this.input.setEnabled(false);this.input.unlock();this.events.paused();}
  quit():void{
    this.mode='menu';this.audio.stopAmbience();this.input.setEnabled(false);this.input.unlock();
    this.camera.position.set(27,18,41);this.camera.lookAt(0,3,0);
  }
  private frame=(time:number):void=>{
    const dt=Math.min(.045,Math.max(.001,(time-this.previousFrame)/1000));this.previousFrame=time;
    if(this.mode==='playing')this.tick(dt);
    else if(this.mode==='menu'){
      // Idle menu view is a real 3D scene, orbiting the relay core.
      this.noise+=dt*.07;
      const radius=41;this.camera.position.set(Math.cos(this.noise+.7)*radius,17,Math.sin(this.noise+.7)*radius);
      this.camera.lookAt(0,3.4,0);
      this.world.update(dt*.35);
    }
    this.updateTrails(dt);
    this.updateImpacts(dt);
    if(this.composer)this.composer.render();
    else this.renderer.render(this.world.scene,this.camera);
    this.fps+=((1/dt)-this.fps)*.06;
    this.animationHandle=requestAnimationFrame(this.frame);
  };
  private tick(dt:number):void{
    this.score.elapsed+=dt;
    this.world.update(dt);
    if(this.input.isDown('Digit1')||this.input.wheel<0)this.weapon.select(0);
    else if(this.input.isDown('Digit2')||this.input.wheel>0)this.weapon.select(1);
    this.input.wheel=0;
    if(this.input.isDown('KeyR'))this.weapon.reload();
    const ads=this.input.aiming&&this.player.alive&&!this.player.sprinting;
    this.player.update(dt,this.input,this.settings,ads);
    const moving=this.player.velocity.lengthSq()>1;
    this.weapon.update(dt,ads,moving&&this.player.alive);
    if(this.player.alive&&this.weapon.tryFire(this.input.firing))this.shoot();
    else if(!this.player.alive)this.weapon.tryFire(false);
    for(const bot of this.bots)bot.update(dt,this.player,(b,hit)=>this.botFire(b,hit));
    if(!this.player.alive&&this.player.respawnTime<=0){
      const safe=[...this.world.spawnPoints].sort((a,b)=>this.botDistance(b)-this.botDistance(a))[0];
      this.player.place(safe);this.audio.click();
    }
    if(matchOver(this.score)){this.finish();return;}
    this.hudTimer-=dt;if(this.hudTimer<=0){this.hudTimer=.1;this.pushHud();}
  }
  private botDistance(pos:THREE.Vector3):number{return Math.min(...this.bots.filter(b=>b.alive).map(b=>b.position.distanceTo(pos)));}
  private shoot():void{
    this.score.shots++;
    const spread=this.weapon.config.spread*(this.input.aiming?.27:1)*(this.player.sprinting?2.2:1);
    const direction=new THREE.Vector3();this.camera.getWorldDirection(direction);
    const side=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0);
    const up=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,1);
    direction.addScaledVector(side,(Math.random()-.5)*spread*2).addScaledVector(up,(Math.random()-.5)*spread*2).normalize();
    const start=this.camera.position.clone();
    this.raycaster.set(start,direction);this.raycaster.far=110;
    const all=[...this.world.solidMeshes,...this.bots.filter(b=>b.alive).flatMap(b=>b.hitMeshes)];
    const hits=this.raycaster.intersectObjects(all,false);
    const first=hits[0];
    const impact=first?.point.clone()??start.clone().addScaledVector(direction,100);
    if(first)this.spark(impact.clone(),first.face?.normal?.clone().transformDirection(first.object.matrixWorld)??direction.clone().negate(),typeof first.object.userData.botId==='number');
    this.trail(start.clone().addScaledVector(direction,.6),impact.clone(),0x79e7e3,.12);
    if(first&&typeof first.object.userData.botId==='number'){
      const bot=this.bots[first.object.userData.botId as number];
      if(bot?.alive){
        this.score.hits++;
        const damage=Math.round(this.weapon.config.damage*(first.object.userData.hitPart==='head'?1.65:1));
        const killed=bot.takeDamage(damage);
        this.audio.hit();this.events.hit(killed);
        if(killed){this.score=registerKill(this.score);this.audio.eliminate();this.events.elimination(bot.name);}
      }
    }
    // Each press has a subtle aiming kick, without violent screen effects.
    if(!this.settings.reducedMotion)this.player.pitch=Math.min(1.48,this.player.pitch+.004);
  }
  private botFire(bot:Bot,hit:boolean):void{
    const from=bot.position.clone().add(new THREE.Vector3(.35,1.37,-.2));
    const target=this.camera.position.clone();target.x+=(Math.random()-.5)*.23;target.y+=(Math.random()-.5)*.22;
    this.trail(from,target,bot.id%2?0xf7a55d:0x59cfdc,.22);
    if(hit&&this.player.takeDamage(7+bot.id*1.4)){
      this.audio.hurt();this.events.damage(7+bot.id*1.4);
      if(!this.player.alive){this.score=registerDeath(this.score);this.audio.tone(260,65,.45,.12,'triangle');}
    }
  }
  private trail(start:THREE.Vector3,end:THREE.Vector3,color:number,duration:number):void{
    const geometry=new THREE.BufferGeometry().setFromPoints([start,end]);
    const material=new THREE.LineBasicMaterial({color,transparent:true,opacity:.65,depthWrite:false});
    const line=new THREE.Line(geometry,material);this.world.scene.add(line);this.trails.push({line,duration});
  }
  private spark(point:THREE.Vector3,normal:THREE.Vector3,robot:boolean):void {
    // Tiny non-graphic energy sparks, fading naturally. Never spawn physics/collision bodies.
    const count=robot?19:11;
    const positions=new Float32Array(count*3),velocities:THREE.Vector3[]=[];
    for(let i=0;i<count;i++){
      const v=normal.clone().multiplyScalar(1.8+Math.random()*3.1);
      v.add(new THREE.Vector3((Math.random()-.5)*5,(Math.random()-.3)*4,(Math.random()-.5)*5));
      velocities.push(v);
      positions[i*3]=point.x;positions[i*3+1]=point.y;positions[i*3+2]=point.z;
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const mat=new THREE.PointsMaterial({color:robot?0x85fff0:0xffbc78,size:robot?.095:.065,transparent:true,opacity:.95,depthWrite:false});
    const points=new THREE.Points(geo,mat);this.world.scene.add(points);
    this.impacts.push({points,life:.29,velocities});
  }
  private updateImpacts(dt:number):void {
    for(let i=this.impacts.length-1;i>=0;i--){
      const impact=this.impacts[i];impact.life-=dt;
      const pos=impact.points.geometry.attributes.position as THREE.BufferAttribute;
      impact.velocities.forEach((v,j)=>{
        pos.setXYZ(j,pos.getX(j)+v.x*dt,pos.getY(j)+v.y*dt,pos.getZ(j)+v.z*dt);
        v.y-=dt*8;
      });
      pos.needsUpdate=true;
      (impact.points.material as THREE.PointsMaterial).opacity=Math.max(0,impact.life/.29);
      if(impact.life<=0){this.world.scene.remove(impact.points);impact.points.geometry.dispose();(impact.points.material as THREE.Material).dispose();this.impacts.splice(i,1);}
    }
  }
  private updateTrails(dt:number):void{
    for(let i=this.trails.length-1;i>=0;i--){
      const t=this.trails[i];t.duration-=dt;
      (t.line.material as THREE.LineBasicMaterial).opacity=Math.max(0,t.duration*3.7);
      if(t.duration<=0){this.world.scene.remove(t.line);t.line.geometry.dispose();(t.line.material as THREE.Material).dispose();this.trails.splice(i,1);}
    }
  }
  private pushHud():void{
    this.events.hud({health:this.player.health,ammo:this.weapon.ammoCount,reserve:this.weapon.reserveCount,
      weapon:`${this.weapon.config.name} / ${this.weapon.config.label}`,reloading:this.weapon.reloadProgress,
      time:formatTime(MATCH_DURATION-this.score.elapsed),kills:this.score.kills,deaths:this.score.deaths,
      aiming:this.input.aiming&&this.player.alive,respawn:this.player.alive?0:Math.max(0,this.player.respawnTime),
      fps:Math.round(this.fps),score:this.score,playerX:this.player.position.x,playerZ:this.player.position.z,
      yaw:this.player.yaw,bots:this.bots});
  }
  private finish():void{
    if(this.mode!=='playing')return;
    this.mode='finished';this.audio.stopAmbience();this.input.setEnabled(false);this.input.unlock();
    this.events.results({score:{...this.score},xp:scoreXP(this.score),won:this.score.kills>=SCORE_LIMIT});
  }
  dispose():void{
    cancelAnimationFrame(this.animationHandle);window.removeEventListener('resize',this.resize);
    this.input.dispose();this.bots.forEach(b=>b.dispose());this.weapon.dispose();this.audio.dispose();
    this.impacts.forEach(x=>{this.world.scene.remove(x.points);x.points.geometry.dispose();(x.points.material as THREE.Material).dispose();});
    this.composer?.dispose();this.world.dispose();this.renderer.dispose();this.renderer.domElement.remove();
  }
}
