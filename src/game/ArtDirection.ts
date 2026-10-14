import * as THREE from 'three';
import type { Obstacle } from './Physics';
import type { Quality } from './Settings';

/** A wholly original, asset-free environment art layer. All collision geometry is untouched. */
export class ArtDirection {
  readonly detail = new THREE.Group();
  readonly fine = new THREE.Group();
  private motes?: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private motePositions?: Float32Array;
  private time = 0;
  private readonly textures: THREE.Texture[] = [];
  private readonly mats: THREE.Material[] = [];
  private readonly sky: THREE.Mesh;
  private readonly animatedLamps: { light: THREE.PointLight; mesh: THREE.Mesh; offset: number }[] = [];

  constructor(private readonly scene: THREE.Scene, private readonly obstacles: readonly Obstacle[]) {
    this.detail.name = 'Art pass / structural details';
    this.fine.name = 'Art pass / high quality microdetails';
    scene.add(this.detail, this.fine);
    this.sky = this.createSky();
    scene.add(this.sky);
    this.retextureBaseWorld();
    this.buildArchitecture();
    this.buildGroundDetails();
    this.buildSkyline();
    this.buildWeather();
    this.setQuality('medium');
  }

  private rng(seed: number): () => number {
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }

  private surface(kind: 'concrete'|'alloy'|'asphalt', seed: number): THREE.CanvasTexture {
    const rng = this.rng(seed), size = 512;
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    const image = ctx.createImageData(size, size);
    const base = kind === 'concrete' ? [157, 161, 154] : kind === 'alloy' ? [152, 175, 182] : [117, 123, 125];
    // Film-grain, mottling, and microscopic variation in rough industrial surfaces.
    const coarse = Array.from({length: 32*32}, () => rng());
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
      const p = (y*size+x)*4;
      const patch = coarse[Math.floor(y/16)*32+Math.floor(x/16)] - .5;
      const fine = (rng()-.5)*38;
      const variation = fine + patch*38 - Math.abs(Math.sin((x+y)*.013))*5;
      for(let channel=0;channel<3;channel++) image.data[p+channel] = Math.max(0,Math.min(255,base[channel]+variation));
      image.data[p+3] = 255;
    }
    ctx.putImageData(image,0,0);
    if(kind==='alloy') {
      for(let x=0;x<size;x+=64){ctx.strokeStyle='rgba(20,32,40,.24)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+1,0);ctx.lineTo(x+1,size);ctx.stroke();ctx.strokeStyle='rgba(240,250,245,.15)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+5,0);ctx.lineTo(x+5,size);ctx.stroke();}
      for(let i=0;i<95;i++){ctx.strokeStyle=`rgba(255,255,255,${rng()*.16})`;ctx.lineWidth=.4+rng();ctx.beginPath();const x=rng()*512,y=rng()*512;ctx.moveTo(x,y);ctx.lineTo(x+(rng()-.5)*70,y+(rng()-.5)*12);ctx.stroke();}
    } else if(kind==='concrete') {
      for(let i=0;i<40;i++) {const x=rng()*512,y=rng()*512;ctx.strokeStyle=`rgba(29,45,47,${.08+rng()*.16})`;ctx.lineWidth=.6+rng()*1.2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+6+rng()*55,y-2-rng()*17);ctx.stroke();}
      ctx.strokeStyle='rgba(55,68,70,.3)';ctx.strokeRect(1,1,510,510);
    } else {
      for(let i=0;i<4500;i++) {const g=Math.floor(rng()*120+70);ctx.fillStyle=`rgba(${g},${g+7},${g+9},${rng()*.23})`;ctx.fillRect(rng()*512,rng()*512,1+rng()*3,1+rng()*2);}
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    tex.anisotropy=8;this.textures.push(tex);
    return tex;
  }

  private material(color:number, metallic=.35, roughness=.62, glow=0): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({color,metalness:metallic,roughness,emissive:glow?color:0x000000,emissiveIntensity:glow});
    this.mats.push(mat);return mat;
  }

  private createSky(): THREE.Mesh {
    const material = new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,fog:false,
      vertexShader:`varying vec3 ray; void main(){ray=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z=gl_Position.w;}`,
      fragmentShader:`varying vec3 ray;
        float hash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453);}
        void main(){ vec3 d=normalize(ray);float h=clamp(d.y*.5+.5,0.0,1.0);
          vec3 bottom=vec3(.26,.27,.29);vec3 haze=vec3(.48,.40,.36);vec3 high=vec3(.052,.115,.19);
          vec3 c=mix(bottom,haze,smoothstep(.13,.38,h));c=mix(c,high,smoothstep(.40,.92,h));
          float cloud=sin(d.x*41.0+d.z*13.0+sin(d.z*14.0))*sin(d.x*27.0-d.z*32.0);
          c+=vec3(.10,.067,.053)*max(0.0,cloud)*smoothstep(.55,.15,abs(d.y));
          float halo=pow(max(0.0,dot(d,normalize(vec3(-.51,.27,-.73)))),17.0);
          float sun=pow(max(0.0,dot(d,normalize(vec3(-.51,.27,-.73)))),380.0);
          c+=halo*vec3(.46,.22,.11)+sun*vec3(2.1,1.25,.52);
          float grain=(hash(floor(d*1500.0))-.5)*.012;
          gl_FragColor=vec4(c+grain,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });this.mats.push(material);
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(650,40,22),material);
    mesh.frustumCulled=false;mesh.renderOrder=-1000;return mesh;
  }

  private retextureBaseWorld():void {
    const concrete=this.surface('concrete',123), steel=this.surface('alloy',779), asphalt=this.surface('asphalt',192);
    this.scene.traverse(obj=>{
      const mesh = obj as THREE.Mesh;
      if(!(mesh.geometry instanceof THREE.BoxGeometry || mesh.geometry instanceof THREE.PlaneGeometry))return;
      const material=mesh.material as THREE.MeshStandardMaterial;
      if(!material?.isMeshStandardMaterial || material.emissiveIntensity>.16)return;
      const p=mesh.geometry.parameters as { width:number; height:number; depth?:number };
      // Deliberately branch on the real geometry type, not on BoxGeometry's static type.
      if(p.depth!==undefined && p.width>3 && p.height>2 && p.depth>2){
        material.map=p.height>6?concrete:steel;material.roughness=p.height>6?.84:.67;
        material.needsUpdate=true;
      } else if(p.depth!==undefined && p.width>12 && p.height<.06 && p.depth>10){
        material.map=asphalt;material.roughness=.94;material.needsUpdate=true;
      } else if(p.depth===undefined && p.width>100){
        material.map=asphalt;material.roughness=.98;material.needsUpdate=true;
      }
    });
  }

  private box(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material):THREE.Mesh {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);mesh.castShadow=h>.2;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  private cylinder(parent:THREE.Object3D,x:number,y:number,z:number,r:number,h:number,mat:THREE.Material,segments=12):THREE.Mesh {
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),mat);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;
  }
  private strip(x:number,y:number,z:number,w:number,d:number,mat:THREE.Material):void{
    this.box(this.detail,x,y,z,w,.028,d,mat);
  }
  private signage(text:string,sub:string,w=4.2,h=1.1,accent='#eca96c'):THREE.CanvasTexture {
    const c=document.createElement('canvas');c.width=1024;c.height=256;
    const g=c.getContext('2d')!;g.fillStyle='#0b1a24';g.fillRect(0,0,1024,256);
    g.fillStyle=accent;g.fillRect(0,0,13,256);g.fillRect(40,33,86,5);
    g.textBaseline='middle';g.font='bold 107px Arial, sans-serif';g.fillStyle='#dfedea';g.fillText(text,51,130);
    g.font='bold 26px monospace';g.fillStyle=accent;g.fillText(sub,55,209);
    g.fillStyle='rgba(244,249,245,.20)';for(let i=0;i<15;i++)g.fillRect(770+i*13,223,6,14);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;this.textures.push(t);void w;void h;return t;
  }

  private buildArchitecture():void {
    const steel=this.material(0x52616c,.78,.33),rivet=this.material(0x8a9997,.84,.32);
    const deep=this.material(0x111e27,.7,.45),glass=this.material(0x263b4a,.37,.23);
    const amber=this.material(0xffa75e,.18,.3,1.5),cyan=this.material(0x59d9d1,.23,.23,1.85);
    const rust=this.material(0x8f6456,.3,.89),paint=this.material(0xe0bc74,.12,.72);
    const buildings: [number,number,number,number,number,string,string][] = [
      [-25,-25,23,12,10,'LOADING BAY','K-04 / STORAGE'],
      [25,-26,20,15,13,'PROCESSING','PLANT 02 / ACTIVE'],
      [-25,23,21,14,9,'UNIT 09','RELAY TRANSIT'],
      [24,23,24,12,11,'CONTROL','SECTOR NETWORK'],
      [-13,14,10,12,8,'MAINTENANCE','AUTHORIZED ACCESS'],
      [16,-13,11,10,10,'GENERATOR','HIGH VOLTAGE']
    ];
    buildings.forEach(([x,z,w,d,h,name,sub],i)=>{
      // Facades: door shutters, cladding seams, corner frames and glass instrumentation.
      for(let j=0;j<Math.floor(w/2.5);j++){
        const px=x-w/2+1.25+j*2.5;
        this.box(this.detail,px,h*.54,z+d/2+.105,.045,h*.7,.12,steel);
        if(j%2===0)this.box(this.detail,px,h*.56,z-d/2-.11,.045,h*.64,.11,steel);
      }
      for(let j=0;j<Math.floor(h/1.4);j++){
        const py=.9+j*1.4;
        this.box(this.detail,x-w/2-.10,py,z,.17,.05,d,deep);
        this.box(this.detail,x+w/2+.10,py,z,.17,.05,d,deep);
      }
      for(const dx of [-w/2+.4,w/2-.4]){
        this.box(this.detail,x+dx,h/2,z+d/2+.12,.23,h,.24,steel);
        this.box(this.detail,x+dx,h/2,z-d/2-.12,.23,h,.24,steel);
      }
      const shutterW=Math.min(4,w*.32);
      this.box(this.detail,x-w*.20,2.35,z+d/2+.13,shutterW,4.2,.12,deep);
      for(let r=0;r<13;r++)this.box(this.detail,x-w*.20,.38+r*.315,z+d/2+.20,shutterW-.14,.035,.07,steel);
      this.box(this.detail,x-w*.20,4.53,z+d/2+.15,shutterW+.3,.16,.27,paint);
      const t=this.signage(name,sub);
      const sign=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w*.47,8),1.75),new THREE.MeshBasicMaterial({map:t}));
      sign.position.set(x+w*.2,h*.79,z+d/2+.16);this.detail.add(sign);this.mats.push(sign.material);
      // Rooftop machinery with exposed conduit and heat exchangers.
      for(let j=0;j<3;j++){
        const rx=x-w*.32+j*(w*.32);
        this.box(this.detail,rx,h+.77,z-d*.13,1.7,1.25,2.4,steel);
        this.box(this.detail,rx,h+1.48,z-d*.13,1.8,.14,2.5,deep);
        for(let v=0;v<7;v++)this.box(this.fine,rx-.71+v*.23,h+.76,z+d*.02,.07,.9,.08,deep);
      }
      for(let j=0;j<2;j++){
        const rx=x+(j?2.1:-2.1);
        this.cylinder(this.detail,rx,h+2.9,z-d*.31,.30,4.5,rust);
        this.cylinder(this.detail,rx,h+5.17,z-d*.31,.5,.32,deep);
      }
      // Every structure is at least visually distinct from the others.
      if(i%2===0){
        const mast=this.cylinder(this.detail,x+w*.3,h+2.35,z, .095,4.7,steel);
        mast.rotation.z=.08;
        for(let j=0;j<4;j++)this.box(this.detail,x+w*.3,h+.9+j*.7,z,.8,.09,.11,cyan);
      }
      const accent=i%2===0?cyan:amber;
      this.box(this.detail,x+w*.3,1.08,z+d/2+.20,1.6,.11,.1,accent);
      for(let j=0;j<4;j++){
        this.box(this.fine,x-w/2+1.1+j*.35,4.55,z+d/2+.23,.2,.2,.11,rivet);
      }
      const cableX=x+w*.39;
      this.cylinder(this.detail,cableX,h+.8,z, .11,1.5,deep);
      this.box(this.detail,cableX,h+1.7,z,1.2,.14,1.2,steel);
    });
    // Ground-level pipe corridors and cable conduits (purely cosmetic so movement stays unchanged).
    for(const [x,z,length] of [[-41,-18,12],[41,8,15],[-38,33,8],[38,-32,10]] as const){
      for(let i=0;i<3;i++){
        const tube=this.cylinder(this.detail,x+i*.5,2.0,z,.18,length,steel);
        tube.rotation.x=Math.PI/2;
      }
      for(let p=-1;p<=1;p++)this.box(this.detail,x,1.55,z+p*length*.4,1.7,3.0,.19,rust);
    }
    // Elevated billboard and signal repeaters frame the central objective from all directions.
    const boardMat=new THREE.MeshBasicMaterial({map:this.signage('RELAY NINE','EST. 2096 / NO SIGNAL LOST',8,2,'#65e5db')});this.mats.push(boardMat);
    const board=new THREE.Mesh(new THREE.PlaneGeometry(9,2.5),boardMat);
    board.position.set(0,10.5,-8.12);this.detail.add(board);
    this.box(this.detail,-4.4,10.4,-8.03,.14,3.2,.17,steel);
    this.box(this.detail,4.4,10.4,-8.03,.14,3.2,.17,steel);
    // Suspended illuminated network links.
    for(const [x,z,c] of [[-12,-7,cyan],[12,-7,amber],[0,12,cyan],[0,-18,amber]] as const){
      const fixture=this.box(this.detail,x,4.2,z,2.2,.14,.44,deep);
      this.box(this.detail,x,4.1,z,2.03,.07,.29,c);
      const light=new THREE.PointLight(c===cyan?0x49cfca:0xffad71,6,12,2);
      light.position.set(x,3.7,z);this.detail.add(light);
      this.animatedLamps.push({light,mesh:fixture,offset:x+z});
    }
    // Origin-markers on the central plinth.
    for(let k=0;k<12;k++){
      const a=k*Math.PI/6;
      const marker=this.box(this.detail,Math.cos(a)*4.05,.085,Math.sin(a)*4.05,.85,.055,.17,k%3?cyan:amber);
      marker.rotation.y=-a;
    }
    // Keep these assets deliberately outside collision; current multiplayer maps remain compatible.
    void glass;
  }

  private buildGroundDetails():void {
    const rough=this.material(0x566368,.15,.9),dark=this.material(0x1c2b34,.1,.94),paint=this.material(0xf6bd7e,.13,.68);
    const wet=new THREE.MeshPhysicalMaterial({color:0x182b34,metalness:.52,roughness:.11,clearcoat:1,clearcoatRoughness:.15,transparent:true,opacity:.46,depthWrite:false});this.mats.push(wet);
    const rng=this.rng(19854);
    // Fine, intermittent industrial lane markings; avoid visual clutter at eye-level.
    for(let x=-38;x<=38;x+=5.2){
      this.strip(x,.056,8.3,2.0,.11,paint);
      this.strip(x,.056,-8.3,2.0,.11,paint);
    }
    for(let z=-38;z<=38;z+=5.6){
      this.strip(-9.1,.055,z,.12,2.2,paint);
      this.strip(9.1,.055,z,.12,2.2,paint);
    }
    for(let k=0;k<11;k++){
      const x=-39+k*7.6;
      const a=this.box(this.detail,x,.062,39.1,3,.025,.5,k%2?dark:paint);a.rotation.y=.0;
    }
    // Grates and drainage on transverse roads (not physical obstacles).
    for(const [x,z] of [[-15,0],[15,0],[0,-23],[0,25],[-33,8],[31,-8]] as const){
      this.box(this.detail,x,.07,z,1.7,.09,2.4,dark);
      for(let s=0;s<8;s++)this.box(this.fine,x-.7+s*.20,.12,z,.06,.027,2.15,rough);
    }
    // Small scattered reflective patches. Never place a puddle under a building's footprint.
    for(let i=0;i<55;i++){
      const x=(rng()-.5)*81,z=(rng()-.5)*81;
      if(this.obstacles.some(o=>x>o.minX-.8&&x<o.maxX+.8&&z>o.minZ-.8&&z<o.maxZ+.8))continue;
      const ellipse=new THREE.Mesh(new THREE.CircleGeometry(.7+rng()*2.3,16),wet);
      ellipse.rotation.x=-Math.PI/2;ellipse.rotation.z=rng()*6.28;
      ellipse.scale.y=.26+rng()*.6;ellipse.position.set(x,.062+rng()*.004,z);this.fine.add(ellipse);
    }
    // Hundreds of tiny mechanical fasteners in one draw call.
    const rivetGeo=new THREE.CylinderGeometry(.036,.036,.02,6);
    const rivetMat=this.material(0xa8b8b4,.76,.27);
    const inst=new THREE.InstancedMesh(rivetGeo,rivetMat,480),d=new THREE.Object3D();
    for(let i=0;i<480;i++){
      d.position.set((rng()-.5)*85,.05,(rng()-.5)*85);
      d.rotation.set(0,0,0);d.scale.setScalar(.6+rng()*.8);d.updateMatrix();inst.setMatrixAt(i,d.matrix);
    }
    inst.instanceMatrix.needsUpdate=true;inst.frustumCulled=false;this.fine.add(inst);
  }

  private buildSkyline():void {
    const haze=this.material(0x213441,.35,.95),shadow=this.material(0x1b2c37,.47,.7);
    const rng=this.rng(4808);
    // Repeated antenna masts and powerlines create depth beyond the play area.
    for(let i=0;i<28;i++){
      const angle=i*Math.PI*2/28,r=81+rng()*25;
      const x=Math.sin(angle)*r,z=Math.cos(angle)*r,top=16+rng()*32;
      this.cylinder(this.detail,x,top*.5,z,.19,top,shadow);
      for(let s=0;s<5;s++)this.box(this.detail,x,top*(.3+s*.12),z,2.8,.09,.13,haze);
      const bulb=this.box(this.detail,x,top,z,.38,.30,.38,i%3?shadow:this.material(0xf19a65,.1,.55,1));
      bulb.rotation.y=.4;
    }
  }

  private buildWeather():void {
    const rng=this.rng(509),points=540,pos=new Float32Array(points*3);
    for(let i=0;i<points;i++){
      pos[i*3]=(rng()-.5)*105;pos[i*3+1]=rng()*20+.3;pos[i*3+2]=(rng()-.5)*105;
    }
    this.motePositions=pos;
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    const mat=new THREE.PointsMaterial({color:0xb3ccce,size:.075,transparent:true,opacity:.29,depthWrite:false,sizeAttenuation:true});this.mats.push(mat);
    this.motes=new THREE.Points(geo,mat);this.motes.frustumCulled=false;this.fine.add(this.motes);
  }

  setQuality(q:Quality):void {
    this.detail.visible=q!=='low';this.fine.visible=q==='high';
    // The sky and surface textures remain enabled at all tiers; higher tiers add geometry.
  }
  update(dt:number):void {
    this.time+=dt;
    for(const l of this.animatedLamps)l.light.intensity=5.5+Math.sin(this.time*1.4+l.offset)*.65;
    if(this.fine.visible&&this.motePositions&&this.motes){
      const p=this.motePositions;
      for(let i=0;i<p.length;i+=3){p[i]+=.13*dt;p[i+1]-=.23*dt;if(p[i+1]<.2)p[i+1]=18.5;if(p[i]>53)p[i]=-53;}
      this.motes.geometry.attributes.position.needsUpdate=true;
    }
  }
  dispose():void {
    for(const group of [this.detail,this.fine]){
      group.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.geometry)mesh.geometry.dispose();});
      group.removeFromParent();
    }
    this.sky.geometry.dispose();this.sky.removeFromParent();
    this.mats.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());
  }
}
