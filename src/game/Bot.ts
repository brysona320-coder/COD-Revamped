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
  private rotors:THREE.Mesh[]=[];
  private legs:THREE.Group[]=[];
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
    // Multi-part original sentry chassis: segmented armor, hydraulics and stabilizing rotors.
    const plate=new THREE.MeshStandardMaterial({color:id%2?0x9a806f:0x71848a,metalness:.85,roughness:.31});
    const servo=new THREE.MeshStandardMaterial({color:0x101921,metalness:.55,roughness:.51});
    const red=new THREE.MeshStandardMaterial({color:0x263a45,emissive:id%2?0xed814d:0x44d5c9,emissiveIntensity:.65,metalness:.62,roughness:.32});
    const addDecor=(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,parent=this.group):THREE.Mesh=>
      add(g,m,parent,x,y,z);
    // Faceted armor over the hitbox (not itself a collider) creates a premium robot silhouette.
    const breast=addDecor(new THREE.CylinderGeometry(.48,.38,.47,6),plate,0,1.40,-.035);
    breast.rotation.z=Math.PI/2;
    addDecor(new THREE.BoxGeometry(.40,.045,.12),red,0,1.51,-.45);
    addDecor(new THREE.BoxGeometry(.49,.25,.15),plate,0,1.85,.15);
    // Stabilizer arms with power couplings and flight surfaces.
    for(const side of [-1,1]){
      const shoulder=addDecor(new THREE.SphereGeometry(.19,10,8),servo,side*.48,1.60,0);
      shoulder.scale.set(1.0,.75,.95);
      const arm=addDecor(new THREE.CylinderGeometry(.105,.14,.68,8),plate,side*.62,1.25,0);
      arm.rotation.z=side*.23;
      addDecor(new THREE.BoxGeometry(.27,.14,.39),servo,side*.68,.96,-.15);
      addDecor(new THREE.BoxGeometry(.26,.035,.32),this.glow,side*.69,.97,-.35);
      const nacelle=addDecor(new THREE.CylinderGeometry(.24,.25,.25,12),servo,side*.53,1.78,.44);
      nacelle.rotation.x=Math.PI/2;
      const rotor=addDecor(new THREE.TorusGeometry(.2,.042,8,16),this.glow,side*.53,1.78,.60);
      rotor.rotation.x=Math.PI/2;this.rotors.push(rotor);
      for(let rib=0;rib<3;rib++)addDecor(new THREE.BoxGeometry(.3,.09,.04),plate,side*.43,1.68+rib*.13,.37);
      const hip=new THREE.Group();hip.position.set(side*.22,.84,0);this.group.add(hip);this.legs.push(hip);
      addDecor(new THREE.CylinderGeometry(.145,.125,.50,9),plate,0,-.24,0,hip);
      addDecor(new THREE.SphereGeometry(.15,8,7),servo,0,-.48,-.05,hip);
      addDecor(new THREE.CylinderGeometry(.095,.125,.38,8),plate,0,-.60,-.07,hip);
      addDecor(new THREE.BoxGeometry(.27,.12,.40),dark,0,-.82,-.15,hip);
      addDecor(new THREE.BoxGeometry(.20,.06,.19),red,0,-.84,-.27,hip);
    }
    // Narrow sensor crown with individually readable glowing optics.
    for(let k=0;k<3;k++){
      const sensor=addDecor(new THREE.SphereGeometry(.065,8,7),this.glow,(k-1)*.145,2.04,-.254,this.head);
      sensor.scale.set(1,.65,.35);
    }
    const antenna=addDecor(new THREE.CylinderGeometry(.027,.040,.43,6),plate,.20,2.48,.09);
    antenna.rotation.z=-.18;
    addDecor(new THREE.SphereGeometry(.07,7,7),this.glow,.24,2.72,.09);
    // Painted faction identifier, intentionally independent from other games.
    for(let line=0;line<3;line++)addDecor(new THREE.BoxGeometry(.055,.04,.015),this.glow,-.22+line*.075,1.25,-.465);
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
    this.rotors.forEach((r,k)=>{r.rotation.z+=dt*(8+k*2);});
    this.legs.forEach((leg,k)=>{leg.rotation.x=Math.sin(this.movePhase+k*Math.PI)*.18;});
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
