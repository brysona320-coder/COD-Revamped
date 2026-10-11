import * as THREE from 'three';
import type { Obstacle } from './Physics';

const palette = {
  steel: 0x253647, dark: 0x142534, concrete: 0x455763,
  copper: 0x977353, sand: 0x52616b, blue: 0x46dfdd, amber: 0xffbd64,
};
export class World {
  readonly scene = new THREE.Scene();
  readonly colliders: Obstacle[] = [];
  readonly solidMeshes: THREE.Mesh[] = [];
  readonly spawnPoints: THREE.Vector3[] = [];
  readonly animated: { mesh: THREE.Object3D; speed: number }[] = [];
  private time = 0;

  constructor() {
    this.scene.background = new THREE.Color(0x0b1927);
    this.scene.fog = new THREE.FogExp2(0x102433, 0.0105);
    this.scene.add(new THREE.HemisphereLight(0x8dc8dd, 0x19232b, 2.2));
    const sun = new THREE.DirectionalLight(0xffcc9b, 2.7);
    sun.position.set(-32, 54, -41); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -58; sun.shadow.camera.right = 58;
    sun.shadow.camera.top = 58; sun.shadow.camera.bottom = -58;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 135;
    sun.shadow.bias = -0.0003;
    this.scene.add(sun);
    const floorMat = this.groundTexture();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ color: 0x788b8a, map: floorMat, roughness: 0.98, metalness: 0.04 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);
    this.makeRoads();
    this.makeFacility();
    this.makeFences();
    this.makeSkyline();
    this.makeDebris();
    this.makeRelayCore();
    const spawn = [[-36,30],[35,29],[-34,-36],[34,-37],[0,32],[0,-36],[-37,0],[37,0]];
    for (const [x,z] of spawn) this.spawnPoints.push(new THREE.Vector3(x, 0, z));
  }

  private mat(color: number, metalness = 0.3, roughness = 0.7): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, metalness, roughness });
  }
  private groundTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#445259'; ctx.fillRect(0,0,512,512);
    // Repeatable deterministic pseudo-grit.
    let seed = 16323; const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 10000; i++) {
      const v = Math.floor(rand()*65 + 58); ctx.fillStyle = `rgba(${v},${v+8},${v+12},${rand()*0.22})`;
      ctx.fillRect(rand()*512,rand()*512,rand()*3+0.5,rand()*3+0.5);
    }
    ctx.strokeStyle = 'rgba(12,22,29,0.42)'; ctx.lineWidth = 2;
    for (let i=0;i<512;i+=128) { ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,512);ctx.stroke(); ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(512,i);ctx.stroke(); }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(10,10); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    return tex;
  }
  private box(x:number,y:number,z:number,w:number,h:number,d:number, color:number, solid=false, material?: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material ?? this.mat(color));
    m.position.set(x,y,z); m.castShadow = h > 0.7; m.receiveShadow = true;
    this.scene.add(m);
    if (solid) {
      this.colliders.push({ minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,height:y+h/2 });
      this.solidMeshes.push(m);
    }
    return m;
  }
  private glow(color: number, intensity = 2): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,metalness:0.2,roughness:0.2});
  }
  private makeRoads(): void {
    const roadMat = this.mat(0x293944, 0.03, 0.95);
    this.box(0,0.012,0,18,0.025,86,0,false,roadMat);
    this.box(0,0.014,0,86,0.025,16,0,false,roadMat);
    const stripeMat = this.glow(0x62767b,0.06);
    for (let z=-39;z<42;z+=8) this.box(0,0.032,z,0.18,0.03,3.4,0,false,stripeMat);
    for (let x=-38;x<40;x+=8) this.box(x,0.035,0,3,0.03,0.14,0,false,stripeMat);
    // Amber visual wayfinding zones.
    for (const z of [-34, 34]) {
      this.box(0,0.038,z,15,0.03,0.13,0,false,this.glow(palette.amber,0.6));
    }
  }
  private makeFacility(): void {
    // Four dissimilar industrial structures form the main sightline and flank routes.
    const buildings: Array<[number,number,number,number,number,number]> = [
      [-25,-25,23,12,10,8], [25,-26,20,15,13,9],
      [-25,23,21,14,9,7], [24,23,24,12,11,8],
      [-13,14,10,12,8,5], [16,-13,11,10,10,7],
    ];
    buildings.forEach(([x,z,w,d,h,i]) => this.building(x,z,w,d,h,i));
    // Core yard has an asymmetric loop of cover, not a copied competitive map.
    const crates: Array<[number,number,number,number,number]> = [
      [-8,-9,6,3,2.9], [7,11,7,3,3.5],[-16,-3,4,3,3.1],[17,6,5,4,2.5],
      [-7,18,7,3,2.6],[10,-20,6,3,3.5],[-27,-1,4,6,2.5],[29,1,4,5,3.2],
      [-9,-27,6,3,2.2],[6,27,5,4,2.8],[-17,35,8,3,2.9],[18,35,9,3,3.4]
    ];
    crates.forEach(([x,z,w,d,h],i) => this.container(x,z,w,d,h,i));
    for (const [x,z] of [[-32,9],[32,-10],[-3,25],[3,-24],[-34,-10],[31,34]]) this.barricade(x,z);
    // A suspended signal gantry with light strips and supporting columns.
    this.box(0,6.4,-7,23,0.7,2,0x334553);
    this.box(-11,3.2,-7,1,6.4,1,0x384c59,true);
    this.box(11,3.2,-7,1,6.4,1,0x384c59,true);
    this.box(0,6.83,-7,21,0.08,0.12,0,false,this.glow(palette.blue,1.8));
    this.box(0,8.1,-7,20,2,0.15,0x344a57);
    // Machinery and signal terminals.
    for (const [x,z] of [[-39,-19],[37,16],[-13,-40],[13,40]]) this.signalTerminal(x,z);
  }
  private building(x:number,z:number,w:number,d:number,h:number,index:number): void {
    const color = [palette.steel,0x344552,0x4b5b63][index%3];
    this.box(x,h/2,z,w,h,d,color,true);
    this.box(x,h+0.17,z,w+1,0.35,d+1,0x192d3b);
    const stripes = Math.max(2,Math.floor(w/4));
    for (let i=0;i<stripes;i++) {
      const xx = x - w/2 + (i+0.5)*w/stripes;
      const light = i%3===0;
      this.box(xx,h*0.58,z+d/2+0.045,w/stripes-0.7,1.5,0.09,0,false,light?this.glow(0x48b7bd,0.75):this.mat(0x102431));
      this.box(xx,h*0.58,z-d/2-0.045,w/stripes-0.7,1.5,0.09,0,false,this.mat(0x1a2934));
    }
    this.box(x,h-0.95,z+d/2+0.08,w*0.75,0.16,0.11,0,false,this.glow(index%2?palette.blue:palette.amber,1.7));
    const letters=['09','K4','HUB','AUX','3A','RELAY'];
    const canvas = document.createElement('canvas'); canvas.width=256;canvas.height=96;
    const ctx=canvas.getContext('2d')!; ctx.fillStyle='#1b303d';ctx.fillRect(0,0,256,96);
    ctx.font='bold 52px monospace';ctx.fillStyle='#cbe1df';ctx.textAlign='center';ctx.fillText(letters[index],128,65);
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
    const label=new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.2),new THREE.MeshBasicMaterial({map:tex}));
    label.position.set(x,h-2.5,z+d/2+0.1); this.scene.add(label);
    for (let i=0;i<3;i++) {
      this.box(x-w/2+1.5+i*3,h+0.75,z+d*0.15,1.3,1.1,1.6,0x182c35);
    }
  }
  private container(x:number,z:number,w:number,d:number,h:number,index:number): void {
    this.box(x,h/2,z,w,h,d,[0x335064,0x66604e,0x405e61,0x7c594a][index%4],true);
    const ribs=Math.ceil(w/1.3);
    for(let i=0;i<ribs;i++) this.box(x-w/2+(i+.5)*w/ribs,h*0.54,z+d/2+0.045,0.07,h*0.77,0.09,0x162c3a);
    this.box(x,h-0.12,z,w+0.07,0.13,d+0.08,0x263845);
    this.box(x,0.55,z+d/2+0.05,w*0.75,0.11,0.08,0,false,this.glow(index%2?0x76c7c5:0xe9a66d,0.3));
  }
  private barricade(x:number,z:number):void {
    this.box(x,0.65,z,5,1.3,0.8,0x687276,true);
    this.box(x,1.25,z,4.7,0.11,0.92,0xddad66);
    for(const dx of [-1.7,0,1.7])this.box(x+dx,.7,z+.45,.2,.65,.08,0x26333b);
  }
  private signalTerminal(x:number,z:number):void {
    this.box(x,1,z,2.1,2,1.6,0x1c3442,true);
    this.box(x,1.3,z+0.82,1.5,0.8,0.08,0,false,this.glow(palette.blue,0.9));
    this.box(x,3.1,z,0.12,2.2,0.12,0x546d71);
    const top=new THREE.Mesh(new THREE.OctahedronGeometry(0.47),this.glow(palette.amber,1.8));
    top.position.set(x,4.1,z);this.scene.add(top);this.animated.push({mesh:top,speed:1});
  }
  private makeRelayCore():void {
    const core = new THREE.Group();core.position.set(0,0,0);this.scene.add(core);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3,3.5,0.4,12),this.mat(0x172e3b));base.position.y=0.25;base.receiveShadow=true;core.add(base);
    for(let i=0;i<8;i++) {
      const a=i/8*Math.PI*2;
      const beam=new THREE.Mesh(new THREE.BoxGeometry(.35,2.7,.35),this.mat(0x506270));
      beam.position.set(Math.cos(a)*2.8,1.7,Math.sin(a)*2.8);core.add(beam);
    }
    const pillar=new THREE.Mesh(new THREE.CylinderGeometry(.9,1.3,4.4,12),this.glow(0x178f9e,0.4));pillar.position.y=2.6;core.add(pillar);
    const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(1.2,1),this.glow(palette.blue,1.4));orb.position.y=5.8;core.add(orb);this.animated.push({mesh:orb,speed:.35});
    for(let i=0;i<2;i++) {
      const ring=new THREE.Mesh(new THREE.TorusGeometry(2.2+i*.4,.055,6,54),this.glow(i?palette.amber:palette.blue,1.4));
      ring.position.y=4.3+i;ring.rotation.x=i?.6:.2;core.add(ring);this.animated.push({mesh:ring,speed:i?.65:-.4});
    }
    const blueLight=new THREE.PointLight(palette.blue,30,22,2);blueLight.position.set(0,5.6,0);this.scene.add(blueLight);
  }
  private makeFences():void {
    const fence = this.mat(0x364e5c,0.7,0.55);
    for(let p=-42;p<43;p+=6) {
      for(const side of [-1,1]) {
        this.box(p,1.6,side*44,0.18,3.2,.18,0,false,fence);
        this.box(side*44,1.6,p,.18,3.2,.18,0,false,fence);
      }
    }
    for(const z of [-44,44]) for(const y of [0.6,2.3,3.15])this.box(0,y,z,88,.13,.14,0,false,fence);
    for(const x of [-44,44]) for(const y of [0.6,2.3,3.15])this.box(x,y,0,.14,.13,88,0,false,fence);
    for(const [x,z] of [[-42,-42],[42,-42],[-42,42],[42,42]]) {
      this.box(x,8,z,.8,16,.8,0x394e5b);
      const lamp=new THREE.SpotLight(0xf3b879,100,56,Math.PI/4,0.7,1.7);
      lamp.position.set(x,15,z); lamp.target.position.set(x*.6,0,z*.6);
      this.scene.add(lamp,lamp.target);
      this.box(x,15,z,2,.4,2,0,false,this.glow(palette.amber,.7));
    }
  }
  private makeSkyline():void {
    let seed=847; const rand=()=>{seed=(seed*1103515245+12345)>>>0;return seed/4294967296;};
    for(let i=0;i<75;i++) {
      const a=i/75*Math.PI*2;const r=64+rand()*40;
      const x=Math.cos(a)*r,z=Math.sin(a)*r,h=6+rand()*32;
      this.box(x,h/2-1,z,5+rand()*11,h,6+rand()*9,0x142b3a);
      if(i%4===0)this.box(x,h,z,1.4,.25,1.4,0,false,this.glow(palette.amber,.5));
    }
  }
  private makeDebris():void {
    const geo=new THREE.BoxGeometry(0.25,0.06,0.45);const mat=this.mat(0x72817e,0.1,1);
    const inst=new THREE.InstancedMesh(geo,mat,230);
    const dummy=new THREE.Object3D(); let s=11893;const rand=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
    for(let i=0;i<230;i++) {
      let x=rand()*84-42,z=rand()*84-42;
      if(this.colliders.some(o=>x>o.minX-1&&x<o.maxX+1&&z>o.minZ-1&&z<o.maxZ+1)) {x=rand()*84-42;z=rand()*84-42;}
      dummy.position.set(x,.055,z);dummy.rotation.set(0,rand()*6.28,rand()*.15);dummy.scale.set(.5+rand()*2,1,.5+rand()*2);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate=true;this.scene.add(inst);
  }
  update(dt:number):void {
    this.time+=dt;
    this.animated.forEach(({mesh,speed},i)=>{mesh.rotation.y+=dt*speed;if(mesh.type==='Mesh'&&i%3===0)mesh.position.y+=Math.sin(this.time*1.8+i)*dt*.05;});
  }
  dispose():void {
    this.scene.traverse((object)=>{
      const mesh=object as THREE.Mesh;
      if(mesh.geometry)mesh.geometry.dispose();
      const mats=mesh.material ? (Array.isArray(mesh.material)?mesh.material:[mesh.material]) : [];
      mats.forEach(mat=>{const material=mat as THREE.MeshStandardMaterial;if(material.map)material.map.dispose();mat.dispose();});
    });
  }
}
