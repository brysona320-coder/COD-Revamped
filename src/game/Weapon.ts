import * as THREE from 'three';
import type { AudioSystem } from './Audio';

export interface WeaponConfig { id:string; name:string; label:string; magazine:number; reserve:number; fireInterval:number; reloadTime:number; damage:number; spread:number; automatic:boolean; }
export const WEAPONS: WeaponConfig[] = [
  { id:'arc7', name:'ARC-7', label:'PULSE CARBINE', magazine:28,reserve:196,fireInterval:.115,reloadTime:1.8,damage:34,spread:.011,automatic:true },
  { id:'nix', name:'NIX-3', label:'BURST SIDEARM', magazine:13,reserve:78,fireInterval:.24,reloadTime:1.25,damage:46,spread:.009,automatic:false },
];
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
  private previousIndex=0;
  get config():WeaponConfig{return WEAPONS[this.index];}
  get isReloading():boolean{return this.reloadLeft>0;}
  get reloadProgress():number{return this.reloadLeft;}
  get aiming():boolean{return this.aimingBlend>.85;}
  get ammoCount():number{return this.ammo[this.index].ammo;}
  get reserveCount():number{return this.ammo[this.index].reserve;}
  constructor(readonly camera:THREE.PerspectiveCamera,private audio:AudioSystem) {
    for(let i=0;i<2;i++) {
      const group=this.makeModel(i);this.camera.add(group);this.groups.push(group);
    }
    this.groups[1].visible=false;
  }
  reset():void {this.index=0;this.ammo=WEAPONS.map(w=>({ammo:w.magazine,reserve:w.reserve}));this.shotCooldown=this.reloadLeft=this.recoil=this.flashLeft=this.aimingBlend=0;this.select(0);}
  private makeModel(i:number):THREE.Group {
    const group=new THREE.Group();
    const metal=new THREE.MeshStandardMaterial({color:i?0x566b77:0x364c5c,metalness:.82,roughness:.28});
    const black=new THREE.MeshStandardMaterial({color:0x111e29,metalness:.55,roughness:.4});
    const accent=new THREE.MeshStandardMaterial({color:i?0xffbd64:0x62e3e1,emissive:i?0xf48a2c:0x2bc8c8,emissiveIntensity:1.3,metalness:.3});
    const glove=new THREE.MeshStandardMaterial({color:0x687c7a,metalness:.06,roughness:.93});
    const box=(x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material)=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=false;group.add(m);return m;
    };
    // Entirely procedural fictional energy weapons, including grip and operator hands.
    const scale=i?.76:1;
    box(0,0,0,.16*scale,.17*scale,.71*scale,metal);
    box(0,.07,-.12,.21*scale,.085*scale,.25*scale,black);
    box(0,-.12,.10,.085*scale,.32*scale,.13*scale,black);
    box(0,-.17,-.08,.12*scale,.22*scale,.16*scale,metal);
    box(0,-.015,-.42,.09*scale,.09*scale,.29*scale,black);
    box(0,.018,-.568,.13*scale,.12*scale,.065*scale,accent);
    box(0,.145,-.18,.05*scale,.095*scale,.18*scale,metal);
    box(0,.18,-.17,.025*scale,.038*scale,.07*scale,accent);
    for(let r=0;r<5;r++)box(-.086*scale,.013,-.31+r*.085,.02,.07,.04,accent);
    box(0,-.07,.3,.17*scale,.08,.25,metal);
    // Foreshortened hand and forearm geometry is visible in first person.
    box(.11,-.22,-.07,.16,.17,.22,glove);
    box(-.1,-.24,.25,.18,.20,.2,glove);
    box(-.13,-.37,.37,.20,.21,.27,black);
    box(.18,-.40,.06,.18,.24,.24,black);
    const flash=new THREE.PointLight(i?0xffb85e:0x68e9ed,0,3,2);flash.position.set(0,.02,-.65);group.add(flash);this.lights.push(flash);
    group.position.set(.32,-.31,-.72);group.rotation.set(.02,-.10,-.05);
    return group;
  }
  select(index:number):void {
    if(index<0||index>=WEAPONS.length||index===this.index&&this.previousIndex===this.index&&this.groups[0]?.visible)return;
    this.index=index;this.reloadLeft=0;this.shotCooldown=.16;this.previousIndex=index;
    this.groups.forEach((g,j)=>{g.visible=j===index;});this.audio.click();
  }
  reload():boolean {
    const mag=this.ammo[this.index];
    if(this.reloadLeft>0||mag.ammo>=this.config.magazine||mag.reserve===0)return false;
    this.reloadLeft=this.config.reloadTime;this.audio.reload();return true;
  }
  update(dt:number,aim:boolean,moving:boolean):void {
    this.shotCooldown=Math.max(0,this.shotCooldown-dt);
    if(this.reloadLeft>0) {
      this.reloadLeft-=dt;
      if(this.reloadLeft<=0){const mag=this.ammo[this.index],count=Math.min(this.config.magazine-mag.ammo,mag.reserve);mag.ammo+=count;mag.reserve-=count;this.reloadLeft=0;this.audio.click();}
    }
    this.flashLeft=Math.max(0,this.flashLeft-dt);
    this.lights.forEach((l,i)=>l.intensity=i===this.index&&this.flashLeft>0?10:0);
    this.recoil=Math.max(0,this.recoil-dt*4.3);
    const target=aim&&this.reloadLeft===0?1:0;
    this.aimingBlend+=(target-this.aimingBlend)*(1-Math.exp(-dt*15));
    const group=this.groups[this.index];
    const m=this.aimingBlend;
    group.position.set(.32*(1-m),-.31*(1-m)-.203*m+this.recoil*.075,-.72*(1-m)-.49*m+this.recoil*.10);
    group.rotation.set(this.recoil*.18+Math.sin(performance.now()*.0019)*(moving?.008:.003),-.10*(1-m),-.05*(1-m)+this.recoil*.075);
    const targetFov=aim?this.camera.userData.baseFov*.74:this.camera.userData.baseFov;
    this.camera.fov+=(targetFov-this.camera.fov)*(1-Math.exp(-dt*13));this.camera.updateProjectionMatrix();
  }
  tryFire(trigger:boolean):boolean {
    if(!trigger){this.triggerReleased=true;return false;}
    if(this.shotCooldown>0||this.reloadLeft>0||(!this.config.automatic&&!this.triggerReleased))return false;
    this.triggerReleased=false;
    if(this.ammoCount===0){this.reload();return false;}
    this.ammo[this.index].ammo--;
    this.shotCooldown=this.config.fireInterval;this.recoil=Math.min(1.4,this.recoil+.30);
    this.flashLeft=.075;this.audio.fire(this.index===1);return true;
  }
  dispose():void {for(const group of this.groups){this.camera.remove(group);group.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();if(m.material){const arr=Array.isArray(m.material)?m.material:[m.material];arr.forEach(mat=>mat.dispose());}});}}
}
