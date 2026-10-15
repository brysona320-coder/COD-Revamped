import { DurableObject } from 'cloudflare:workers';
import { GUN_GAME_ORDER, WEAPONS, gunGameWeapon, scoreLimit, type GameMode } from '../src/shared/Arsenal';
import { ARENA_BOXES, canSpawn, rayWallDistance, selectSpawn } from '../src/shared/Arena';
import {cleanName,cleanRoom,ONLINE_DURATION,ONLINE_WEAPONS,ROOM_LIMIT,type ClientPacket,type NetPlayer,type ServerPacket} from '../src/shared/Protocol';
interface Env { ROOMS:DurableObjectNamespace<ArenaRoom>;ASSETS:Fetcher }
interface LivePlayer extends NetPlayer {
  lastMove:number;lastFire:number;spawnTime:number;reloadFinish:number;
  magazine:number[];reserve:number[];mode:GameMode;
}
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'}});
const finite=(...numbers:number[])=>numbers.every(v=>typeof v==='number'&&Number.isFinite(v));
const now=()=>Date.now();

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const url=new URL(request.url);
    if(url.pathname==='/api/health')return json({ok:true,name:'ECHOFRONT',multiplayer:true,version:'0.3.0',rooms:'Cloudflare Durable Objects'});
    if(url.pathname.startsWith('/api/rooms/')){
      const code=cleanRoom(url.pathname.slice('/api/rooms/'.length));
      if(code.length<3||code.length>14)return json({error:'Room code must be 3–14 letters/numbers.'},400);
      if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket upgrade required'},426);
      const stub=env.ROOMS.get(env.ROOMS.idFromName(code));
      return stub.fetch(new Request('https://room.internal/connect?room='+encodeURIComponent(code),request));
    }
    return env.ASSETS.fetch(request);
  },
};

export class ArenaRoom extends DurableObject<Env> {
  private players=new Map<WebSocket,LivePlayer>();
  private started=0;
  private roundEnd=0;
  private round:'waiting'|'playing'|'finished'='waiting';
  private broadcastAt=0;
  private roomCode='PUBLIC';
  private gameMode:GameMode='ffa';
  constructor(ctx:DurableObjectState,env:Env){
    super(ctx,env);
    for(const ws of this.ctx.getWebSockets()){
      const saved=ws.deserializeAttachment() as LivePlayer|null;
      if(saved&&typeof saved.id==='string'){this.players.set(ws,saved);this.gameMode=saved.mode==='gun-game'?'gun-game':'ffa';}
    }
    if(this.players.size>=2){this.started=now();this.round='playing';}
  }
  async fetch(request:Request):Promise<Response>{
    this.roomCode=new URL(request.url).searchParams.get('room')??'PUBLIC';
    if(this.ctx.getWebSockets().length>=ROOM_LIMIT)return json({error:'Room is full'},429);
    if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket required'},426);
    const pair=new WebSocketPair(),client=pair[0],server=pair[1];
    this.ctx.acceptWebSocket(server);
    // Join packet arrives from the client; do not count unnamed sockets as players.
    return new Response(null,{status:101,webSocket:client});
  }
  webSocketMessage(ws:WebSocket,raw:string|ArrayBuffer):void{
    if(typeof raw!=='string'||raw.length>1200){this.send(ws,{type:'error',message:'Invalid packet'});return;}
    let message:ClientPacket;
    try{message=JSON.parse(raw) as ClientPacket;}catch{return;}
    if(!message||typeof message.type!=='string')return;
    if(message.type==='join'){
      if(this.players.has(ws))return;
      if(this.players.size>=ROOM_LIMIT){this.send(ws,{type:'error',message:'Room is full'});ws.close(1008,'Room full');return;}
      const requestedMode:GameMode=message.mode==='gun-game'?'gun-game':'ffa';
      if(this.players.size&&requestedMode!==this.gameMode){
        this.send(ws,{type:'error',message:'Room is set to '+this.gameMode+'. Select the same mode to join.'});
        ws.close(1008,'Different mode');return;
      }
      if(!this.players.size)this.gameMode=requestedMode;
      const enemies=Array.from(this.players.values()).filter(p=>p.alive).map(p=>({x:p.x,z:p.z}));
      const sp=selectSpawn(ARENA_BOXES,enemies,Math.floor(Math.random()*10000));
      const player:LivePlayer={id:crypto.randomUUID(),name:cleanName(String(message.name??'')),x:sp.x,y:0,z:sp.z,yaw:0,pitch:0,
        health:100,alive:true,kills:0,deaths:0,weapon:this.gameMode==='gun-game'?gunGameWeapon(0):0,stage:0,shield:true,mode:this.gameMode,
        lastMove:now(),lastFire:0,spawnTime:now(),reloadFinish:0,
        magazine:WEAPONS.map(w=>w.magazine),reserve:WEAPONS.map(w=>w.reserve)};
      this.players.set(ws,player);this.persist(ws,player);
      const room=this.roomCode;
      this.send(ws,{type:'welcome',id:player.id,room, self:this.publicPlayer(player),players:this.allPlayers(),mode:this.gameMode});
      if(this.round==='waiting'&&this.players.size>=2){this.started=now();this.round='playing';}
      this.broadcast(true);return;
    }
    const p=this.players.get(ws);if(!p)return;
    this.rollRound();
    if(message.type==='move'){
      const m=message;
      if(!finite(m.x,m.y,m.z,m.yaw,m.pitch)||!Number.isInteger(m.weapon)||m.weapon<0||m.weapon>=WEAPONS.length)return;
      if(Math.abs(m.y)>3.0||Math.abs(m.pitch)>1.55||Math.abs(m.yaw)>100000)return;
      const t=now(),dt=Math.min(1,Math.max(.016,(t-p.lastMove)/1000));
      if(t-p.lastMove<20)return;
      p.lastMove=t;
      const maxDelta=13*dt+1.15;
      const delta=Math.hypot(m.x-p.x,m.z-p.z);
      if(p.alive&&delta<=maxDelta&&canSpawn(m.x,m.z,ARENA_BOXES,.42)){
        p.x=m.x;p.y=Math.max(0,m.y);p.z=m.z;
      }
      p.yaw=m.yaw;p.pitch=m.pitch;p.weapon=this.gameMode==='gun-game'?gunGameWeapon(p.stage):m.weapon;
      p.shield=t-p.spawnTime<2000;
    }
    if(message.type==='reload'){
      if(!Number.isInteger(message.weapon)||message.weapon<0||message.weapon>=WEAPONS.length)return;
      const i=message.weapon,c=ONLINE_WEAPONS[i];
      if(c.role==='melee'||(this.gameMode==='gun-game'&&i!==gunGameWeapon(p.stage)))return;
      if(p.reloadFinish||p.magazine[i]>=c.magazine||p.reserve[i]<=0)return;
      p.reloadFinish=now()+c.reloadTime*1000;p.weapon=i;
    }
    if(message.type==='fire')this.fire(p,message.weapon);
    if(message.type==='respawn'&&!p.alive&&now()-p.spawnTime>3100)this.respawn(p);
    this.persist(ws,p);
    this.broadcast();
  }
  webSocketClose(ws:WebSocket):void{this.drop(ws);}
  webSocketError(ws:WebSocket):void{this.drop(ws);}
  private publicPlayer(p:LivePlayer):NetPlayer{return {id:p.id,name:p.name,x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch,health:p.health,alive:p.alive,kills:p.kills,deaths:p.deaths,weapon:p.weapon,stage:p.stage,shield:p.shield};}
  private allPlayers():NetPlayer[]{return [...this.players.values()].map(p=>this.publicPlayer(p));}
  private send(ws:WebSocket,data:ServerPacket):void{try{ws.send(JSON.stringify(data));}catch{/* disconnections close independently */}}
  private sendAll(data:ServerPacket):void{for(const ws of this.players.keys())this.send(ws,data);}
  private persist(ws:WebSocket,p:LivePlayer):void{ws.serializeAttachment(p);}
  private drop(ws:WebSocket):void{
    this.players.delete(ws);
    if(this.players.size===0){this.started=0;this.roundEnd=0;this.round='waiting';}
    else if(this.players.size<2&&this.round==='playing'){this.started=0;this.round='waiting';}
    this.broadcast(true);
  }
  private respawn(p:LivePlayer):void{
    const enemies=[...this.players.values()].filter(x=>x!==p&&x.alive).map(e=>({x:e.x,z:e.z}));
    const sp=selectSpawn(ARENA_BOXES,enemies,Math.floor(Math.random()*10000));
    Object.assign(p,{x:sp.x,z:sp.z,y:0,health:100,alive:true,spawnTime:now(),shield:true,
      weapon:this.gameMode==='gun-game'?gunGameWeapon(p.stage):0,
      magazine:WEAPONS.map(w=>w.magazine),reserve:WEAPONS.map(w=>w.reserve),reloadFinish:0,lastFire:0});
  }
  private rollRound():void{
    if(this.round==='playing'&&now()-this.started>=ONLINE_DURATION*1000)this.finishRound();
    if(this.round==='finished'&&now()-this.roundEnd>=14000){
      for(const p of this.players.values()){p.kills=0;p.deaths=0;p.stage=0;this.respawn(p);}
      this.round=this.players.size>=2?'playing':'waiting';this.started=now();
    }
  }
  private finishRound():void{
    if(this.round==='finished')return;
    this.round='finished';this.roundEnd=now();
    const ranked=this.allPlayers().sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths);
    this.sendAll({type:'round_end',winner:ranked[0]?.name??'NO CONTEST',players:ranked});
  }
  private fire(p:LivePlayer,weapon:number):void{
    if(!Number.isInteger(weapon)||weapon<0||weapon>=WEAPONS.length||!p.alive||this.round!=='playing'||p.shield)return;
    if(this.gameMode==='gun-game'&&weapon!==gunGameWeapon(p.stage))return;
    const t=now(),c=ONLINE_WEAPONS[weapon];
    if(p.reloadFinish){if(t<p.reloadFinish)return;
      const n=Math.min(c.magazine-p.magazine[weapon],p.reserve[weapon]);p.magazine[weapon]+=n;p.reserve[weapon]-=n;p.reloadFinish=0;
    }
    if(t-p.lastFire<c.fireInterval*1000-10||(c.role!=='melee'&&p.magazine[weapon]===0))return;
    p.weapon=weapon;if(c.role!=='melee')p.magazine[weapon]--;p.lastFire=t;
    // Aim is computed from the validated latest orientation, not from a target ID supplied by the shooter.
    const cp=Math.cos(p.pitch),direction={x:-Math.sin(p.yaw)*cp,y:Math.sin(p.pitch),z:-Math.cos(p.yaw)*cp};
    const origin={x:p.x,y:p.y+1.72,z:p.z},wall=Math.min(c.range,rayWallDistance(origin,direction));
    let nearest=wall,target:LivePlayer|undefined,impactY=0;
    for(const candidate of this.players.values()){
      if(candidate===p||!candidate.alive||candidate.shield)continue;
      const cx=candidate.x-origin.x,cy=candidate.y+1.25-origin.y,cz=candidate.z-origin.z;
      const t0=cx*direction.x+cy*direction.y+cz*direction.z;
      if(t0<0||t0>=nearest)continue;
      const miss=(cx-direction.x*t0)**2+(cy-direction.y*t0)**2+(cz-direction.z*t0)**2;
      if(miss<=.63**2){nearest=t0;target=candidate;impactY=origin.y+direction.y*t0;}
    }
    this.sendAll({type:'shot',id:p.id,x:origin.x,y:origin.y,z:origin.z,tx:origin.x+direction.x*nearest,ty:origin.y+direction.y*nearest,tz:origin.z+direction.z*nearest});
    if(!target)return;
    const damage=Math.round(c.damage*(impactY>target.y+1.7?1.35:1));
    target.health=Math.max(0,target.health-damage);
    const dead=target.health===0;
    const ownerSocket=[...this.players].find(([,x])=>x===p)?.[0];
    if(ownerSocket)this.send(ownerSocket,{type:'hit',target:target.id,damage,kill:dead});
    if(dead){target.alive=false;target.spawnTime=t;target.deaths++;p.kills++;
      if(this.gameMode==='gun-game'){
        p.stage=Math.min(p.kills,GUN_GAME_ORDER.length-1);
        p.weapon=gunGameWeapon(p.stage);
        p.reloadFinish=0;
      }
      const victimSocket=[...this.players].find(([,x])=>x===target)?.[0];
      if(victimSocket)this.persist(victimSocket,target);
      this.sendAll({type:'feed',attacker:p.name,victim:target.name});
      if(p.kills>=scoreLimit(this.gameMode))this.finishRound();
    }
  }
  private broadcast(force=false):void{
    const t=now();if(!force&&t-this.broadcastAt<95)return;this.broadcastAt=t;
    const remaining=this.round==='waiting'?ONLINE_DURATION:this.round==='finished'?0:Math.max(0,ONLINE_DURATION-Math.floor((t-this.started)/1000));
    this.sendAll({type:'snapshot',players:this.allPlayers(),remaining,round:this.round,limit:scoreLimit(this.gameMode),mode:this.gameMode});
  }
}
