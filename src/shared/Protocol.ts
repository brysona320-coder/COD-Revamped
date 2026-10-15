export interface NetPlayer {
  id:string;name:string;x:number;y:number;z:number;yaw:number;pitch:number;
  health:number;alive:boolean;kills:number;deaths:number;weapon:number;shield:boolean;
}
export type ServerPacket =
 | {type:'welcome';id:string;room:string;self:NetPlayer;players:NetPlayer[]}
 | {type:'snapshot';players:NetPlayer[];remaining:number;round:'waiting'|'playing'|'finished';limit:number}
 | {type:'hit';target:string;damage:number;kill:boolean}
 | {type:'shot';id:string;x:number;y:number;z:number;tx:number;ty:number;tz:number}
 | {type:'feed';attacker:string;victim:string}
 | {type:'round_end';winner:string;players:NetPlayer[]}
 | {type:'error';message:string};
export type ClientPacket =
 | {type:'join';name:string}
 | {type:'move';x:number;y:number;z:number;yaw:number;pitch:number;weapon:number}
 | {type:'fire';weapon:number}
 | {type:'reload';weapon:number}
 | {type:'respawn'};
export const ROOM_LIMIT=8,ONLINE_DURATION=300,ONLINE_SCORE_LIMIT=25;
export const ONLINE_WEAPONS=[{damage:34,magazine:28,reserve:196,interval:115,reload:1800},
  {damage:46,magazine:13,reserve:78,interval:240,reload:1250}] as const;
export const cleanRoom=(room:string):string=>room.toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,14);
export const cleanName=(name:string):string=>name.replace(/[^a-zA-Z0-9_ -]/g,'').trim().slice(0,18)||'OPERATOR';
