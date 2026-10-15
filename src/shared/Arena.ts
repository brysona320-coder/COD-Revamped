// Single collision/spawn model shared by the browser simulation and Cloudflare server.
// Keep in sync with World.ts props when changing physical map geometry.
export interface ArenaBox { minX:number;maxX:number;minZ:number;maxZ:number;height:number }
export const BUILDINGS: Array<[number,number,number,number,number,number]> = [
  [-25,-25,23,12,10,8],[25,-26,20,15,13,9],[-25,23,21,14,9,7],
  [24,23,24,12,11,8],[-13,14,10,12,8,5],[16,-13,11,10,10,7],
];
export const CONTAINERS: Array<[number,number,number,number,number]> = [
  [-8,-9,6,3,2.9],[7,11,7,3,3.5],[-16,-3,4,3,3.1],[17,6,5,4,2.5],
  [-7,18,7,3,2.6],[10,-20,6,3,3.5],[-27,-1,4,6,2.5],[29,1,4,5,3.2],
  [-9,-27,6,3,2.2],[6,27,5,4,2.8],[-17,35,8,3,2.9],[18,35,9,3,3.4],
];
export const BARRICADES: Array<[number,number]> = [[-32,9],[32,-10],[-3,25],[3,-24],[-34,-10],[31,34]];
export const TERMINALS: Array<[number,number]> = [[-39,-19],[37,16],[-13,-40],[13,40]];
export const START_CANDIDATES: Array<[number,number]> = [
  [0,34],[0,-35],[-36,30],[36,30],[-35,-36],[35,-36],[-38,0],[38,0],
  [-8,34],[10,35],[-10,-36],[12,-35],[-37,18],[38,-22],[-35,-17],[34,16],
  [0,23],[1,-28],[-20,1],[22,1],[-11,2],[11,-2],[0,40],[0,-40],
];
const box=(x:number,z:number,w:number,d:number,height:number):ArenaBox=>({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,height});
export const ARENA_BOXES:ArenaBox[] = [
  ...BUILDINGS.map(([x,z,w,d,h])=>box(x,z,w,d,h)),
  ...CONTAINERS.map(([x,z,w,d,h])=>box(x,z,w,d,h)),
  ...BARRICADES.map(([x,z])=>box(x,z,5,.8,1.3)),
  box(-11,-7,1,1,6.4),box(11,-7,1,1,6.4),
  ...TERMINALS.map(([x,z])=>box(x,z,2.1,1.6,2)),
];
export function canSpawn(x:number,z:number,boxes:readonly ArenaBox[]=ARENA_BOXES,radius=.75):boolean{
  if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>43-radius||Math.abs(z)>43-radius)return false;
  return boxes.every(b=>{
    const cx=Math.max(b.minX,Math.min(b.maxX,x)),cz=Math.max(b.minZ,Math.min(b.maxZ,z));
    return b.height<.1||(x-cx)**2+(z-cz)**2>=radius**2;
  });
}
export function selectSpawn(boxes:readonly ArenaBox[],enemies:readonly {x:number;z:number}[],salt=0):{x:number;z:number}{
  const possible=START_CANDIDATES.filter(([x,z])=>canSpawn(x,z,boxes,0.8));
  if(!possible.length){
    for(let d=0;d<=38;d+=2){for(let x=-38;x<=38;x+=4)for(const z of [-d,d])if(canSpawn(x,z,boxes,.8))return {x,z};}
    throw new Error('Arena has no safe spawn locations');
  }
  // Maximize distance from opponents, tiebreak deterministically using salt.
  const ranked=possible.map(([x,z],i)=>({x,z,score:enemies.length?Math.min(...enemies.map(e=>(e.x-x)**2+(e.z-z)**2)):0,tie:(i+Math.abs(salt|0)*7)%possible.length}));
  ranked.sort((a,b)=>b.score-a.score||a.tie-b.tie);
  return {x:ranked[0].x,z:ranked[0].z};
}
// Check full-height ray against rectangular level solids, for server-side line of sight.
export function rayWallDistance(origin:{x:number;y:number;z:number},direction:{x:number;y:number;z:number},boxes:readonly ArenaBox[]=ARENA_BOXES,max=110):number{
  let nearest=max;
  for(const b of boxes){let lo=0,hi=nearest;
    for(const [p,v,min,maxi] of [[origin.x,direction.x,b.minX,b.maxX],[origin.y,direction.y,0,b.height],[origin.z,direction.z,b.minZ,b.maxZ]]){
      if(Math.abs(v)<1e-8){if(p<min||p>maxi){lo=Infinity;break;}}else{
        const a=(min-p)/v,c=(maxi-p)/v;lo=Math.max(lo,Math.min(a,c));hi=Math.min(hi,Math.max(a,c));
        if(hi<lo)break;
      }
    }
    if(lo<=hi&&lo>=0)nearest=Math.min(nearest,lo);
  }
  return nearest;
}
