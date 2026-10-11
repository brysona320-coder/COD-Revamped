import * as THREE from 'three';
import { canStand, findPath, moveWithCollision, segmentBlocked } from './Physics';
import type { World } from './World';
import type { Player } from './Player';

const names=['KITE-01','LATCH-02','MOTH-03','VEGA-04','VOLT-05'];
export class Bot {
  readonly group=new THREE.Group();
  readonly hitMeshes:THREE.Mesh[]=[];
  readonly position=new THREE.Vector3();
  readonly name:string;
  health=100;
  alive=true;
  respawnLeft=0;
  attacks=0;
  private shotCooldown=0;
  private route:THREE.Vector3[]=[];
  private repath=0;
  private movePhase=0;
  private aimDir=new THREE.Vector3();
  private glow:THREE.MeshStandardMaterial;
  private head:THREE.Group;
  private spawnIndex:number;
  constructor(readonly id:number,private world:World) {
    this.name=names[id%names.length];this.spawnIndex=(id+1)%this.world.spawnPoints.length;
    this.glow=new THREE.MeshStandardMaterial({color:id%2?0xffb57b:0x72e2df,emissive:id%2?0xf27636:0x21b7bd,emissiveIntensity:1.5,metalness:.45,roughness:.3});
    const armor=new THREE.MeshStandardMaterial({color:id%2?0x725649:0x3d6470,metalness:.7,roughness:.38});
    const dark=new THREE.MeshStandardMaterial({color:0x142b37,metalness:.66,roughness:.4});
    const add=(geo:THREE.BufferGeometry,mat:THREE.Material,parent:THREE.Group,x=0,y=0,z=0,part?:string):THREE.Mesh=>{
      const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);
      if(part){m.userData.hitPart=part;m.userData.botId=id;this.hitMeshes.push(m);}return m;
    };
    add(new THREE.CylinderGeometry(.36,.47,.9,8),armor,this.group,0,1.28,0,'body');
    add(new THREE.BoxGeometry(.68,.25,.34),dark,this.group,0,1.65,0,'body');
    add(new THREE.BoxGeometry(.26,.55,.24),dark,this.group,-.19,.53,0,'body');
    add(new THREE.BoxGeometry(.26,.55,.24),dark,this.group,.19,.53,0,'body');
    this.head=new THREE.Group();this.head.position.y=1.95;this.group.add(this.head);
    add(new THREE.IcosahedronGeometry(.28,1),dark,this.head,0,0,0,'head');
    add(new THREE.BoxGeometry(.46,.12,.09),this.glow,this.head,0,.03,-.24,'head');
    add(new THREE.BoxGeometry(.35,.12,.4),this.glow,this.group,0,1.38,-.36,'body');
    add(new THREE.BoxGeometry(.17,.19,.63),armor,this.group,.45,1.36,-.38);
    add(new THREE.BoxGeometry(.13,.13,.25),this.glow,this.group,.45,1.37,-.80);
    const sensor = add(new THREE.TorusGeometry(.46,.03,5,20),this.glow,this.group,0,2.31,0);
    sensor.rotation.x=Math.PI/2;
    this.world.scene.add(this.group);
    this.respawn();
  }
  respawn():void {
    // Each bot cycles through deterministic viable spawn positions.
    for(let attempt=0;attempt<this.world.spawnPoints.length;attempt++) {
      this.spawnIndex=(this.spawnIndex+1)%this.world.spawnPoints.length;
      if(this.spawnIndex===4)continue; // keep the operator's initial insertion point clear
      const point=this.world.spawnPoints[this.spawnIndex];
      if(canStand(point.x,point.z,0,this.world.colliders,.55)){this.position.copy(point);break;}
    }
    this.group.position.copy(this.position);this.health=100;this.alive=true;this.respawnLeft=0;this.group.visible=true;
    this.shotCooldown=1.2+this.id*.28;this.repath=0;this.route=[];
  }
  takeDamage(amount:number):boolean {
    if(!this.alive)return false;
    this.health=Math.max(0,this.health-amount);
    if(this.health===0) {this.alive=false;this.respawnLeft=2.9+this.id*.25;this.group.visible=false;return true;}
    this.glow.emissiveIntensity=3;
    return false;
  }
  update(dt:number,player:Player,onShoot:(bot:Bot,hit:boolean)=>void):void {
    if(!this.alive){this.respawnLeft-=dt;if(this.respawnLeft<=0)this.respawn();return;}
    this.glow.emissiveIntensity+=(1.5-this.glow.emissiveIntensity)*Math.min(1,dt*9);
    this.repath-=dt;this.shotCooldown-=dt;
    const dist=this.position.distanceTo(player.position);
    const visible=player.alive&&dist<40&&!segmentBlocked(this.position.x,this.position.z,player.position.x,player.position.z,this.world.colliders,1.25);
    if(this.repath<=0){this.route=findPath(this.position.x,this.position.z,player.position.x,player.position.z,this.world.colliders);this.repath=.85+this.id*.1;}
    // Bots advance until they have a usable firing lane, then strafe instead of charging blindly.
    let target=this.route[0]??player.position;
    if(this.route.length&&this.position.distanceTo(target)<2.15){this.route.shift();target=this.route[0]??player.position;}
    this.aimDir.set(target.x-this.position.x,0,target.z-this.position.z);
    if(visible&&dist<17){this.aimDir.set(player.position.z-this.position.z,0,-(player.position.x-this.position.x));
      this.aimDir.set(Math.sin(this.id*3+performance.now()*.00035),0,Math.cos(this.id*3+performance.now()*.00035));
    }
    else if(dist<3.6) this.aimDir.set(0,0,0);
    if(this.aimDir.lengthSq()>.02){
      this.aimDir.normalize();const speed=visible?2.2:3.1+this.id*.11;
      moveWithCollision(this.position,this.aimDir.x*speed*dt,this.aimDir.z*speed*dt,this.world.colliders,.48);
      this.movePhase+=dt*speed*5;
    }
    this.group.position.copy(this.position);this.group.position.y+=Math.sin(this.movePhase)*.045;
    if(player.alive){
      const direction=Math.atan2(player.position.x-this.position.x,player.position.z-this.position.z);
      this.group.rotation.y=direction+Math.PI;
      this.head.rotation.y=Math.sin(performance.now()*.001+this.id)*.11;
    }
    if(visible&&this.shotCooldown<=0&&dist<35) {
      this.shotCooldown=1.1+this.id*.13+Math.random()*.42;
      this.attacks++;
      // Distance and movement affect accuracy; the player still gets a reaction window.
      const chance=Math.max(.22,.83-dist*.013-(player.sprinting?.13:0));
      onShoot(this,Math.random()<chance);
    }
  }
  dispose():void {
    this.world.scene.remove(this.group);
    this.group.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();if(m.material){const arr=Array.isArray(m.material)?m.material:[m.material];arr.forEach(mat=>mat.dispose());}});
  }
}
