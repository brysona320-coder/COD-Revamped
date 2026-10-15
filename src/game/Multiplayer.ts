import type {ClientPacket,NetPlayer,ServerPacket,GameMode} from '../shared/Protocol';
import {cleanName,cleanRoom} from '../shared/Protocol';
export class MultiplayerClient {
  private socket:WebSocket|undefined;
  id='';room='';
  onWelcome:(self:NetPlayer,mode:GameMode)=>void=()=>{};
  onSnapshot:(packet:Extract<ServerPacket,{type:'snapshot'}>)=>void=()=>{};
  onShot:(packet:Extract<ServerPacket,{type:'shot'}>)=>void=()=>{};
  onHit:(packet:Extract<ServerPacket,{type:'hit'}>)=>void=()=>{};
  onFeed:(packet:Extract<ServerPacket,{type:'feed'}>)=>void=()=>{};
  onRoundEnd:(packet:Extract<ServerPacket,{type:'round_end'}>)=>void=()=>{};
  onStatus:(message:string,ended:boolean)=>void=()=>{};
  private connecting=false;
  private preferredMode:GameMode='ffa';
  connect(room:string,name:string,mode:GameMode='ffa'):void{
    this.close();this.id='';this.connecting=true;this.room=cleanRoom(room);this.preferredMode=mode;
    if(this.room.length<3){this.onStatus('Room code must be 3 or more characters',true);return;}
    const url=new URL(`/api/rooms/${this.room}`,window.location.origin);
    url.protocol=url.protocol==='https:'?'wss:':'ws:';
    try{
      const ws=new WebSocket(url.href);this.socket=ws;
      ws.addEventListener('open',()=>this.send({type:'join',name:cleanName(name),mode:this.preferredMode}));
      ws.addEventListener('message',event=>this.receive(String(event.data)));
      ws.addEventListener('error',()=>{if(ws===this.socket)this.onStatus('Could not connect to the multiplayer service',false);});
      ws.addEventListener('close',()=>{if(ws===this.socket){const failed=this.connecting;this.socket=undefined;this.connecting=false;this.onStatus(failed?'Room unavailable or full':'Connection to room lost',true);}});
    }catch{this.onStatus('Unable to open multiplayer connection',true);}
  }
  private receive(raw:string):void{
    let p:ServerPacket;try{p=JSON.parse(raw) as ServerPacket;}catch{return;}
    if(p.type==='welcome'){this.connecting=false;this.id=p.id;this.room=p.room;this.onWelcome(p.self,p.mode);}
    if(p.type==='snapshot')this.onSnapshot(p);
    if(p.type==='shot')this.onShot(p);
    if(p.type==='hit')this.onHit(p);
    if(p.type==='feed')this.onFeed(p);
    if(p.type==='round_end')this.onRoundEnd(p);
    if(p.type==='error')this.onStatus(p.message,true);
  }
  send(packet:ClientPacket):void{if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify(packet));}
  close():void{const socket=this.socket;this.socket=undefined;this.connecting=false;if(socket)socket.close(1000,'Leaving room');}
  get connected():boolean{return this.socket?.readyState===WebSocket.OPEN&&!!this.id;}
}
