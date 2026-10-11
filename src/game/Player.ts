import * as THREE from 'three';
import { moveWithCollision, type Obstacle } from './Physics';
import type { Settings } from './Settings';

export class Input {
  keys = new Set<string>();
  firing = false;
  aiming = false;
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  private enabled = true;
  onUnlock: () => void = () => {};
  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('mousemove', this.mouse);
    window.addEventListener('mousedown', this.mouseDown);
    window.addEventListener('mouseup', this.mouseUp);
    window.addEventListener('blur', this.blur);
    canvas.addEventListener('contextmenu', this.noContext);
    canvas.addEventListener('wheel', this.scroll, {passive:false});
    document.addEventListener('pointerlockchange', this.lockChange);
  }
  private down=(e:KeyboardEvent):void=>{
    if (['Space','Tab','ArrowUp','ArrowDown'].includes(e.code) && document.pointerLockElement === this.canvas) e.preventDefault();
    this.keys.add(e.code);
  };
  private up=(e:KeyboardEvent):void=>{this.keys.delete(e.code);};
  private mouse=(e:MouseEvent):void=>{
    if(document.pointerLockElement===this.canvas && this.enabled) {this.mouseDX+=e.movementX;this.mouseDY+=e.movementY;}
  };
  private mouseDown=(e:MouseEvent):void=>{
    if(document.pointerLockElement!==this.canvas || !this.enabled)return;
    if(e.button===0)this.firing=true;if(e.button===2)this.aiming=true;
  };
  private mouseUp=(e:MouseEvent):void=>{if(e.button===0)this.firing=false;if(e.button===2)this.aiming=false;};
  private noContext=(e:MouseEvent):void=>{e.preventDefault();};
  private scroll=(e:WheelEvent):void=>{if(document.pointerLockElement===this.canvas){e.preventDefault();this.wheel=Math.sign(e.deltaY);}};
  private blur=():void=>{this.clear();};
  private lockChange=():void=>{if(document.pointerLockElement!==this.canvas){this.clear();this.onUnlock();}};
  setEnabled(enabled:boolean):void{this.enabled=enabled;if(!enabled)this.clear();}
  isDown(key:string):boolean{return this.keys.has(key);}
  clear():void{this.keys.clear();this.mouseDX=0;this.mouseDY=0;this.firing=false;this.aiming=false;this.wheel=0;}
  lock():void{try{void this.canvas.requestPointerLock();}catch{ /* Browser may deny until direct interaction */ }}
  unlock():void{if(document.pointerLockElement===this.canvas)document.exitPointerLock();}
  dispose():void{
    window.removeEventListener('keydown',this.down);window.removeEventListener('keyup',this.up);
    window.removeEventListener('mousemove',this.mouse);window.removeEventListener('mousedown',this.mouseDown);
    window.removeEventListener('mouseup',this.mouseUp);window.removeEventListener('blur',this.blur);
    this.canvas.removeEventListener('contextmenu',this.noContext);this.canvas.removeEventListener('wheel',this.scroll);
    document.removeEventListener('pointerlockchange',this.lockChange);
  }
}

export class Player {
  position = new THREE.Vector3(0,0,32); // Feet, not eye position
  yaw = 0;
  pitch = 0;
  velocity = new THREE.Vector3();
  verticalVelocity = 0;
  health = 100;
  alive = true;
  invulnerable = 0;
  respawnTime = 0;
  grounded = true;
  crouching = false;
  sprinting = false;
  sliding = 0;
  eyeHeight = 1.72;
  walkTime = 0;
  private wasCrouch = false;
  private wasJump = false;
  private wasVault = false;
  constructor(readonly camera: THREE.PerspectiveCamera, private obstacles: readonly Obstacle[]) {this.place(new THREE.Vector3(0,0,32));}
  place(position:THREE.Vector3):void {
    this.position.copy(position);this.velocity.set(0,0,0);this.verticalVelocity=0;
    this.health=100;this.alive=true;this.invulnerable=1.65;this.respawnTime=0;
    this.sliding=0;this.eyeHeight=1.72;this.grounded=true;this.pitch=0;
    this.syncCamera(0,false);
  }
  takeDamage(amount:number): boolean {
    if(!this.alive||this.invulnerable>0)return false;
    this.health=Math.max(0,this.health-amount);
    if(this.health===0){this.alive=false;this.respawnTime=3.3;}
    return true;
  }
  update(dt:number,input:Input,settings:Settings,ads:boolean):void {
    if(this.invulnerable>0)this.invulnerable-=dt;
    if(!this.alive){this.respawnTime=Math.max(0,this.respawnTime-dt);return;}
    this.yaw-=input.mouseDX*settings.sensitivity*.01;
    this.pitch-=input.mouseDY*settings.sensitivity*.01;
    this.pitch=Math.max(-1.48,Math.min(1.48,this.pitch));
    input.mouseDX=0;input.mouseDY=0;
    const forward=Number(input.isDown('KeyW'))-Number(input.isDown('KeyS'));
    const right=Number(input.isDown('KeyD'))-Number(input.isDown('KeyA'));
    const length=Math.max(1,Math.hypot(forward,right));
    const isMoving=forward!==0||right!==0;
    const crouch=input.isDown('ControlLeft')||input.isDown('ControlRight')||input.isDown('KeyC');
    const sprint=input.isDown('ShiftLeft')&&forward>0&&!ads&&!crouch&&isMoving;
    if(crouch&&!this.wasCrouch&&this.sprinting&&this.grounded) this.sliding=.72;
    this.wasCrouch=crouch;
    this.sprinting=sprint&&!this.sliding;this.crouching=crouch||this.sliding>0;
    if(this.sliding>0)this.sliding=Math.max(0,this.sliding-dt);
    const speed=this.sliding>0?10.2:sprint?8.4:crouch?2.8:ads?3.4:5.7;
    const x=(right*Math.cos(this.yaw)-forward*Math.sin(this.yaw))/length;
    const z=(-right*Math.sin(this.yaw)-forward*Math.cos(this.yaw))/length;
    const factor=1-Math.exp(-dt*(this.sliding>0?3:13));
    if(this.sliding>0){this.velocity.multiplyScalar(1-dt*0.22);}
    else {this.velocity.x+=(x*speed-this.velocity.x)*factor;this.velocity.z+=(z*speed-this.velocity.z)*factor;}
    const jump=input.isDown('Space');
    if(jump&&!this.wasJump&&this.grounded&&!this.crouching){this.verticalVelocity=7.4;this.grounded=false;}
    this.wasJump=jump;
    const vault=input.isDown('KeyE');
    if(vault&&!this.wasVault&&this.grounded){
      const px=this.position.x-Math.sin(this.yaw)*1.1,pz=this.position.z-Math.cos(this.yaw)*1.1;
      if(this.obstacles.some(o=>o.height>0.45&&o.height<1.65&&px>o.minX-.5&&px<o.maxX+.5&&pz>o.minZ-.5&&pz<o.maxZ+.5)) {
        this.verticalVelocity=9.2;this.grounded=false;
        this.velocity.x-=Math.sin(this.yaw)*4;this.velocity.z-=Math.cos(this.yaw)*4;
      }
    }
    this.wasVault=vault;
    this.verticalVelocity-=20*dt;this.position.y+=this.verticalVelocity*dt;
    if(this.position.y<=0){this.position.y=0;this.verticalVelocity=0;this.grounded=true;}
    moveWithCollision(this.position,this.velocity.x*dt,this.velocity.z*dt,this.obstacles);
    const targetHeight=this.crouching?1.03:1.72;
    this.eyeHeight+=(targetHeight-this.eyeHeight)*(1-Math.exp(-11*dt));
    if(isMoving&&this.grounded)this.walkTime+=dt*(sprint?13:crouch?5:9);
    this.syncCamera(dt,settings.reducedMotion);
  }
  private syncCamera(_dt:number,reducedMotion:boolean):void {
    const bob=reducedMotion?0:Math.sin(this.walkTime)*Math.min(.032,this.velocity.length()*.004)*(this.grounded?1:0);
    this.camera.position.copy(this.position);this.camera.position.y+=this.eyeHeight+bob;
    this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');
  }
}
