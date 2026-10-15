// Fictional ECHOFRONT equipment: shared by the browser and Cloudflare room authority.
export type GameMode = 'ffa' | 'gun-game';
export type WeaponRole = 'carbine' | 'sidearm' | 'smg' | 'marksman' | 'sniper' | 'melee';
export interface WeaponConfig {
  id:string; name:string; label:string; role:WeaponRole;
  magazine:number; reserve:number; fireInterval:number; reloadTime:number;
  damage:number; spread:number; automatic:boolean; range:number; adsZoom:number;
}
export const WEAPONS:readonly WeaponConfig[]=[
  {id:'arc7',name:'ARC-7',label:'PULSE CARBINE',role:'carbine',magazine:28,reserve:196,fireInterval:.115,reloadTime:1.8,damage:34,spread:.011,automatic:true,range:110,adsZoom:.74},
  {id:'nix',name:'NIX-3',label:'BURST SIDEARM',role:'sidearm',magazine:13,reserve:78,fireInterval:.24,reloadTime:1.25,damage:46,spread:.009,automatic:false,range:90,adsZoom:.78},
  {id:'veil',name:'VEIL-9',label:'PHANTOM SMG',role:'smg',magazine:42,reserve:252,fireInterval:.072,reloadTime:1.65,damage:22,spread:.024,automatic:true,range:60,adsZoom:.82},
  {id:'vex',name:'VEX-5',label:'ION SMG',role:'smg',magazine:34,reserve:204,fireInterval:.09,reloadTime:1.5,damage:28,spread:.019,automatic:true,range:72,adsZoom:.8},
  {id:'rift',name:'RIFT-12',label:'MARKSMAN RAIL',role:'marksman',magazine:10,reserve:60,fireInterval:.49,reloadTime:2.15,damage:78,spread:.004,automatic:false,range:140,adsZoom:.54},
  {id:'ghost',name:'GHOST-50',label:'LONG-RANGE LANCER',role:'sniper',magazine:5,reserve:35,fireInterval:1.12,reloadTime:2.65,damage:110,spread:.0015,automatic:false,range:160,adsZoom:.33},
  {id:'shard',name:'SHARD-0',label:'ENERGY BLADE',role:'melee',magazine:1,reserve:0,fireInterval:.56,reloadTime:0,damage:105,spread:0,automatic:false,range:2.9,adsZoom:1},
];
export const BLADE_INDEX=WEAPONS.findIndex(w=>w.role==='melee');
export const GUN_GAME_ORDER:readonly number[]=[1,2,0,3,4,5,6];
export const gunGameWeapon=(stage:number):number=>GUN_GAME_ORDER[Math.min(GUN_GAME_ORDER.length-1,Math.max(0,Math.floor(stage)))]??0;
export const scoreLimit=(mode:GameMode):number=>mode==='gun-game'?GUN_GAME_ORDER.length:25;
