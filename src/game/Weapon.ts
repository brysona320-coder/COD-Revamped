import * as THREE from 'three';
import type { AudioSystem } from './Audio';
import { WEAPONS } from '../shared/Arsenal';
import type { WeaponConfig } from '../shared/Arsenal';
export { WEAPONS } from '../shared/Arsenal';
interface Mag { ammo:number; reserve:number }
export class Weapon {
  index=0;
  ammo:Mag[]=WEAPONS.map(w=>({ammo:w.magazine,reserve:w.reserve}));
  private groups:THREE.Group[]=[];
  private shotCooldown=0;
  private reloadLeft=0;
  private recoil=0;
  private flashLeft=0;
  private triggerReleased=true;
  private aimingBlend=0;
  private lights:THREE.PointLight[]=[];
  private flashes: THREE.Group[]=[];
  private sway = 0;
  private previousIndex=0;
  get config():WeaponConfig{return WEAPONS[this.index];}
  get isReloading():boolean{return this.reloadLeft>0;}
  get reloadProgress():number{return this.reloadLeft;}
  get aiming():boolean{return this.aimingBlend>.85;}
  get ammoCount():number{return this.ammo[this.index].ammo;}
  get reserveCount():number{return this.ammo[this.index].reserve;}
  constructor(readonly camera:THREE.PerspectiveCamera,private audio:AudioSystem) {
    for(let i=0;i<WEAPONS.length;i++) {
      const group=this.makeModel(i);this.camera.add(group);this.groups.push(group);
    }
    this.groups.forEach((g,i)=>{g.visible=i===0;});
  }
  reset():void {this.index=0;this.ammo=WEAPONS.map(w=>({ammo:w.magazine,reserve:w.reserve}));this.shotCooldown=this.reloadLeft=this.recoil=this.flashLeft=this.aimingBlend=0;this.select(0);}
  private makeModel(i:number):THREE.Group {
    const group=new THREE.Group();
    const config=WEAPONS[i];
    group.name=config.name+' / original modular sci-fi equipment';
    const isPistol=config.role==='sidearm';
    const isSMG=config.role==='smg';
    const isPrecision=config.role==='sniper'||config.role==='marksman';
    if(config.role==='melee'){
      const dark=new THREE.MeshStandardMaterial({color:0x172a34,metalness:.55,roughness:.38});
      const alloy=new THREE.MeshStandardMaterial({color:0xc4e2e7,metalness:.92,roughness:.18});
      const glow=new THREE.MeshStandardMaterial({color:0x7bfff1,emissive:0x26e9da,emissiveIntensity:3});
      const create=(w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material)=>{
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);group.add(mesh);return mesh;
      };
      create(.085,.11,.29,.01,-.08,.14,dark).rotation.x=-.15;
      create(.23,.045,.11,0,.015,-.04,alloy);
      create(.085,.028,.56,0,.02,-.39,alloy);
      create(.015,.035,.57,.049,.035,-.39,glow);
      const tip=new THREE.Mesh(new THREE.ConeGeometry(.058,.28,4),alloy);
      tip.rotation.x=-Math.PI/2;tip.position.set(0,.02,-.79);group.add(tip);
      const glove=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),dark);
      glove.scale.set(1.2,.8,1.3);glove.position.set(.09,-.21,.24);group.add(glove);
      const sleeve=create(.22,.25,.27,.12,-.4,.37,dark);sleeve.rotation.z=-.2;
      this.flashes.push(new THREE.Group());
      this.lights.push(new THREE.PointLight(0x7bfff1,0,2));
      group.position.set(.36,-.30,-.7);
      return group;
    }
    const scale=isPistol?.78:isSMG?.85:config.role==='sniper'?1.14:1;
    const colors=[0x485561,0x6a7079,0x344d5f,0x54445f,0x506478,0x314655];
    const caseMat=new THREE.MeshStandardMaterial({color:colors[i]??0x485561,metalness:.76,roughness:.32});
    const upper=new THREE.MeshStandardMaterial({color:0x859394,metalness:.84,roughness:.23});
    const black=new THREE.MeshStandardMaterial({color:0x0b1219,metalness:.35,roughness:.63});
    const grip=new THREE.MeshStandardMaterial({color:0x252e35,metalness:.22,roughness:.85});
    const metalDark=new THREE.MeshStandardMaterial({color:0x182936,metalness:.85,roughness:.34});
    const accents=[0x80ebdf,0xffba72,0x72cfff,0xd3a3ff,0xc7f0fc,0xffe5a6];
    const accent=accents[i]??0x80ebdf;
    const emissive=new THREE.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:2.3,metalness:.34,roughness:.19});
    const glove=new THREE.MeshStandardMaterial({color:0x66716c,metalness:.06,roughness:.94});
    const armor=new THREE.MeshStandardMaterial({color:0x2b373e,metalness:.22,roughness:.73});
    const add=(geometry:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number,parent:THREE.Group=group):THREE.Mesh=>{
      const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);parent.add(m);return m;
    };
    const cube=(x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material,parent=group):THREE.Mesh=>
      add(new THREE.BoxGeometry(w*scale,h*scale,d*scale),mat,x*scale,y*scale,z*scale,parent);
    const pipe=(x:number,y:number,z:number,r:number,length:number,mat:THREE.Material):THREE.Mesh=>{
      const p=add(new THREE.CylinderGeometry(r*scale,r*scale,length*scale,12),mat,x*scale,y*scale,z*scale);
      p.rotation.x=Math.PI/2;return p;
    };
    // Main receiver, stepped metal armor, trigger assembly and grip.
    cube(0,0,0,.205,.205,isPistol?.45:.76,caseMat);
    cube(0,.105,.025,.24,.08,isPistol?.40:.57,upper);
    cube(0,-.115,.16,.115,.28,.16,grip).rotation.x=-.15;
    cube(0,-.207,.15,.146,.045,.18,metalDark);
    cube(0,-.037,.32,.20,.09,.3,black);
    cube(0,-.065,-.20,.12,.11,.36,metalDark);
    // Handguard: a rounded barrel shroud with ribs and an original split vent system.
    pipe(0,.014,-.29,.069,isPistol?.38:.52,metalDark);
    pipe(0,.012,-.54,.041,isPistol?.20:.42,black);
    pipe(0,.012,isPistol?-.60:-.75,.060,.15,upper);
    cube(0,.02,-.40,.23,.105,.34,caseMat);
    for(let j=0;j<7;j++){
      cube(-.119,.017,-.52+j*.047,.018,.055,.021,upper);
      cube(.119,.017,-.52+j*.047,.018,.055,.021,upper);
    }
    // Split top rail, sight, illuminated power readout and tactical scope.
    cube(0,.149,-.15,.10,.03,.5,black);
    for(let j=0;j<10;j++)cube(0,.171,-.38+j*.048,.125,.023,.016,upper);
    const sight=cube(0,.23,-.10,.11,.095,.18,metalDark);
    sight.rotation.x=.03;
    // Open optical sight, with aperture centred on the camera's ballistic axis in ADS.
    // A solid glowing cube here used to cover the target and obscure aim.
    const ring=add(new THREE.TorusGeometry(.041*scale,.006*scale,8,24),upper,0,.23*scale,-.13*scale);
    ring.rotation.z=0;
    add(new THREE.SphereGeometry(.008*scale,8,6),emissive,0,.23*scale,-.134*scale);
    cube(0,.23,-.004,.073,.012,.014,black);
    cube(0,.09,.21,.23,.09,.14,upper);
    // Original geometric manufacturer and battery display panel.
    cube(.116,.032,.095,.012,.065,.20,emissive);
    for(let j=0;j<4;j++)cube(-.112,.032,-.08+j*.064,.016,.044,.024,emissive);
    // Reinforced stock, detachable battery pack and carbon-fiber-esque grip plates.
    if(!isPistol){
      cube(0,-.045,.42,.14,.13,.28,metalDark);
      cube(0,-.094,.61,.18,.27,.09,black);
      cube(0,-.19,-.01,.09,.25,.17,caseMat).rotation.x=.18;
      cube(0,-.205,-.028,.10,.15,.095,emissive);
      for(let j=0;j<5;j++)cube(.062,-.14-j*.031,.174,.012,.014,.1,upper);
    } else {
      cube(0,-.19,.15,.134,.26,.14,grip);
      cube(0,-.35,.14,.16,.06,.18,upper);
    }
    // Distinct original silhouettes: compact submachine receivers and long optical rails.
    if(isSMG){
      cube(0,-.13,-.06,.18,.27,.17,grip);
      cube(0,.24,-.20,.17,.065,.28,upper);
      cube(.14,.08,-.3,.04,.14,.27,emissive);
      for(let k=0;k<5;k++)cube(0,.07,-.58+k*.065,.20,.025,.018,black);
    }
    if(isPrecision){
      const scope=pipe(0,.28,-.18,.087,config.role==='sniper'?.62:.40,black);
      scope.rotation.x=Math.PI/2;
      pipe(0,.28,-.18,.048,.64,upper);
      cube(0,.19,-.18,.09,.17,.16,metalDark);
      cube(0,.008,-.92,.085,.10,.42,black);
      cube(0,-.035,.59,.23,.19,.25,caseMat);
      for(let k=0;k<4;k++)cube(.105,.05,-.52+k*.12,.022,.025,.05,emissive);
    }
    // Anatomical-scale operator gloves and sleeves. Their silhouettes fill the viewmodel.
    const hand=(x:number,y:number,z:number,tilt:number)=>{
      const palm=add(new THREE.SphereGeometry(.112,10,8),glove,x,y,z);
      palm.scale.set(1.0,.85,1.25);palm.rotation.z=tilt;
      const wrist=cube(x,y-.15,z+.10,.21,.24,.23,armor);
      wrist.rotation.z=tilt;
      const sleeve=cube(x,y-.38,z+.21,.27,.28,.29,black);
      sleeve.rotation.z=tilt;
      for(let finger=0;finger<3;finger++) {
        const f=add(new THREE.SphereGeometry(.033,8,6),glove,x-.070+finger*.069,y+.016,z-.085);
        f.scale.z=1.45;
      }
    };
    hand(.125,-.20,-.16,-.10);
    hand(-.14,-.28,.26,.22);
    // Emissive flash geometry visible briefly at each shot, synchronised with the point light.
    const flashRoot=new THREE.Group();
    flashRoot.position.set(0,.012*scale,(isPistol?-.71:-.83)*scale);
    const core=add(new THREE.IcosahedronGeometry(.14*scale,1),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,depthWrite:false}),0,0,0,flashRoot);
    core.scale.set(.55,.55,1);
    for(let p=0;p<6;p++){
      const a=p*Math.PI/3;
      const spike=add(new THREE.ConeGeometry(.038*scale,.30*scale,4),new THREE.MeshBasicMaterial({color:isPistol?0xffbc73:0x8aeee4,depthWrite:false}),Math.cos(a)*.065,Math.sin(a)*.065,-.04,flashRoot);
      spike.rotation.set(-Math.PI/2,0,a);
    }
    flashRoot.visible=false;group.add(flashRoot);this.flashes.push(flashRoot);
    const flash=new THREE.PointLight(accent,0,4,2);
    flash.position.copy(flashRoot.position);group.add(flash);this.lights.push(flash);
    group.position.set(.32,-.31,-.72);group.rotation.set(.02,-.10,-.05);
    return group;
  }
  select(index:number):void {
    if(index<0||index>=WEAPONS.length||(index===this.index&&this.groups[index]?.visible))return;
    this.index=index;this.reloadLeft=0;this.shotCooldown=.16;this.previousIndex=index;this.triggerReleased=true;
    this.groups.forEach((g,j)=>{g.visible=j===index;});this.audio.click();
  }
  reload():boolean {
    const mag=this.ammo[this.index];
    if(this.config.role==='melee'||this.reloadLeft>0||mag.ammo>=this.config.magazine||mag.reserve===0)return false;
    this.reloadLeft=this.config.reloadTime;this.audio.reload();return true;
  }
  update(dt:number,aim:boolean,moving:boolean):void {
    this.shotCooldown=Math.max(0,this.shotCooldown-dt);
    if(this.reloadLeft>0) {
      this.reloadLeft-=dt;
      if(this.reloadLeft<=0){const mag=this.ammo[this.index],count=Math.min(this.config.magazine-mag.ammo,mag.reserve);mag.ammo+=count;mag.reserve-=count;this.reloadLeft=0;this.audio.click();}
    }
    this.flashLeft=Math.max(0,this.flashLeft-dt);
    this.lights.forEach((l,i)=>l.intensity=i===this.index&&this.flashLeft>0?26:0);
    this.flashes.forEach((g,i)=>{g.visible=i===this.index&&this.flashLeft>0;g.rotation.z+=dt*13;});
    this.recoil=Math.max(0,this.recoil-dt*4.3);
    const target=aim&&this.reloadLeft===0&&this.config.role!=='melee'?1:0;
    this.aimingBlend+=(target-this.aimingBlend)*(1-Math.exp(-dt*15));
    const group=this.groups[this.index];
    this.sway+=dt*(moving?8:1.5);
    const m=this.aimingBlend;
    const swayX=Math.sin(this.sway)*(.004+(moving?.007:0))*(1-m*.7);
    const swayY=Math.abs(Math.cos(this.sway))*(moving?.006:.002)*(1-m*.7);
    // Each weapon's sight line moves to exact camera centre; no sight offset at full ADS.
    const opticHeight=.23*(this.config.role==='sidearm'?.78:this.config.role==='smg'?.85:1);
    group.position.set(.32*(1-m)+swayX,-.31*(1-m)-opticHeight*m+this.recoil*.075+swayY,-.72*(1-m)-.49*m+this.recoil*.10);
    const reloadTilt=this.reloadLeft>0?Math.sin((1-this.reloadLeft/this.config.reloadTime)*Math.PI)*.25:0;
    group.rotation.set(this.recoil*(this.config.role==='melee'?.65:.18)+Math.sin(performance.now()*.0019)*(moving?.008:.003)+reloadTilt,-.10*(1-m),-.05*(1-m)+this.recoil*(this.config.role==='melee'?.55:.075)+reloadTilt*.45);
    const targetFov=aim?this.camera.userData.baseFov*this.config.adsZoom:this.camera.userData.baseFov;
    this.camera.fov+=(targetFov-this.camera.fov)*(1-Math.exp(-dt*13));this.camera.updateProjectionMatrix();
  }
  tryFire(trigger:boolean):boolean {
    if(!trigger){this.triggerReleased=true;return false;}
    if(this.shotCooldown>0||this.reloadLeft>0||(!this.config.automatic&&!this.triggerReleased))return false;
    this.triggerReleased=false;
    if(this.config.role!=='melee'&&this.ammoCount===0){this.reload();return false;}
    if(this.config.role!=='melee')this.ammo[this.index].ammo--;
    this.shotCooldown=this.config.fireInterval;
    this.recoil=Math.min(1.4,this.recoil+(this.config.role==='sniper'?.92:this.config.role==='melee'?.8:.30));
    this.flashLeft=this.config.role==='melee'?0:.075;
    this.audio.fire(this.config.role);return true;
  }
  dispose():void {for(const group of this.groups){this.camera.remove(group);group.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();if(m.material){const arr=Array.isArray(m.material)?m.material:[m.material];arr.forEach(mat=>mat.dispose());}});}}
}
