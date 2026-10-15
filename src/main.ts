import './style.css';
import './arsenal.css';
import { Game, type HudData, type Results } from './game/Game';
import { MultiplayerClient } from './game/Multiplayer';
import { cleanName, cleanRoom, type NetPlayer, type GameMode } from './shared/Protocol';
import { GUN_GAME_ORDER, WEAPONS } from './shared/Arsenal';
import { loadSettings, saveSettings, type Quality } from './game/Settings';
import { accuracy, formatTime } from './game/Rules';

const el = <T extends HTMLElement = HTMLElement>(id:string):T => {
  const node=document.getElementById(id);if(!node)throw new Error(`Missing UI element #${id}`);return node as T;
};
const toggle=(id:string,show:boolean)=>{el(id).hidden=!show;};
const text=(id:string,value:string|number)=>{el(id).textContent=String(value);};
const menu=el('menu'),pause=el('pause'),settingsEl=el('settings'),resultsEl=el('results');
const onlineMenu=el('online-menu'), onlineStatus=el('online-status');
const minimap=el<HTMLCanvasElement>('minimap');
const ctx=minimap.getContext('2d');
const net=new MultiplayerClient();
let settings=loadSettings();
let previousOverlay:'menu'|'pause'='menu';
let alertTimeout=0;
let lastOnlineRound:'waiting'|'playing'|'finished'='waiting';
let wasOnline=false;

const storeKey='echofront.records.v1';
interface RecordData { best:number; trials:number; xp:number }
function loadRecords():RecordData {
  try {const r=JSON.parse(localStorage.getItem(storeKey)??'{}') as Partial<RecordData>;
    return {best:Number(r.best)||0,trials:Number(r.trials)||0,xp:Number(r.xp)||0};}
  catch{return {best:0,trials:0,xp:0};}
}
let records=loadRecords();
function showRecords():void{text('personal-best',`${records.best} ELIMS`);text('trials-completed',records.trials);}
showRecords();

function alert(message:string):void{
  const node=el('center-alert');node.textContent=message;node.classList.remove('show');
  void node.offsetWidth;node.classList.add('show');
  clearTimeout(alertTimeout);alertTimeout=window.setTimeout(()=>node.classList.remove('show'),1550);
}
function addFeed(message:string):void {
  const feed=el('kill-feed'),item=document.createElement('div');item.className='feed-item';item.textContent=message;
  feed.prepend(item);while(feed.children.length>5)feed.lastElementChild?.remove();
  setTimeout(()=>item.remove(),5600);
}
function drawMap(data:HudData):void{
  if(!ctx)return;
  const w=minimap.width,h=minimap.height,scale=1.82;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='rgba(7,19,30,.88)';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='rgba(90,180,182,.13)';ctx.lineWidth=1;
  for(let t=0;t<=w;t+=22){ctx.beginPath();ctx.moveTo(t,0);ctx.lineTo(t,h);ctx.stroke();ctx.beginPath();ctx.moveTo(0,t);ctx.lineTo(w,t);ctx.stroke();}
  ctx.save();ctx.translate(w/2,h/2);
  for(const o of game.world.colliders){
    const x=(o.minX-data.playerX)*scale,y=(o.minZ-data.playerZ)*scale;
    ctx.fillStyle='rgba(99,131,143,.36)';ctx.fillRect(x,y,(o.maxX-o.minX)*scale,(o.maxZ-o.minZ)*scale);
  }
  if(game.session==='online'){
    for(const p of game.onlinePlayers){if(!p.alive||p.id===net.id)continue;
      const x=(p.x-data.playerX)*scale,z=(p.z-data.playerZ)*scale;
      if(Math.abs(x)>w/2||Math.abs(z)>h/2)continue;
      ctx.fillStyle='#e9ab71';ctx.beginPath();ctx.arc(x,z,3.3,0,Math.PI*2);ctx.fill();
    }
  }else for(const bot of data.bots){if(!bot.alive)continue;
    const x=(bot.position.x-data.playerX)*scale,z=(bot.position.z-data.playerZ)*scale;
    if(Math.abs(x)>w/2||Math.abs(z)>h/2)continue;
    ctx.fillStyle='#ed9b67';ctx.beginPath();ctx.arc(x,z,3.25,0,Math.PI*2);ctx.fill();
  }
  ctx.rotate(-data.yaw);
  ctx.fillStyle='#79efeb';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5,6);ctx.lineTo(0,3);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();
  ctx.restore();
  ctx.strokeStyle='rgba(108,210,203,.55)';ctx.lineWidth=1;ctx.strokeRect(.5,.5,w-1,h-1);
}
function hud(data:HudData):void{
  text('health-number',Math.ceil(data.health));el('health-fill').style.width=`${data.health}%`;
  text('match-time',data.time);
  text('match-score',`${String(data.kills).padStart(2,'0')} / ${data.limit}`);
  text('weapon-name',data.weapon);text('ammo-current',data.ammo);text('ammo-reserve',data.reserve);
  text('weapon-state',data.reloading>0?'RECHARGING…':data.gameMode==='gun-game'?'GUN GAME · ELIMINATE TO ADVANCE':data.role==='melee'?'CLOSE-RANGE ENERGY BLADE':'R RELOAD · 1–7 / WHEEL SWITCH · V BLADE');
  if(data.role==='melee'){text('ammo-current','∞');text('ammo-reserve','BLADE');}
  toggle('gun-game-progress',data.gameMode==='gun-game');
  if(data.gameMode==='gun-game'){
    const stage=Math.min(data.stage,GUN_GAME_ORDER.length-1)+1;
    text('gun-game-stage',`STAGE ${stage} / ${GUN_GAME_ORDER.length}`);
    text('gun-game-next',stage===GUN_GAME_ORDER.length?'FINAL ROUND · ENERGY BLADE':`NEXT: ${WEAPONS[GUN_GAME_ORDER[stage]].name}`);
    el('gun-game-fill').style.width=`${(data.kills/data.limit)*100}%`;
  }
  document.body.classList.toggle('scoped',data.aiming&&data.role==='sniper');
  text('fps',`${Math.min(999,data.fps)} FPS`);
  toggle('respawn',data.respawn>0);
  if(data.respawn>0)text('respawn-seconds',Math.ceil(data.respawn));
  document.body.classList.toggle('aiming',data.aiming);
  drawMap(data);
}
function showGame():void {
  menu.hidden=true;pause.hidden=true;resultsEl.hidden=true;settingsEl.hidden=true;onlineMenu.hidden=true;
  toggle('hud',true);board.hidden=true;
}
function leaveOnline():void {
  net.close();net.id='';net.room='';wasOnline=false;lastOnlineRound='waiting';
  history.replaceState(null,'',window.location.pathname);
}
function start(mode:GameMode='ffa'):void {
  leaveOnline();showGame();el('kill-feed').replaceChildren();game.start(mode);
  text('match-label',mode==='gun-game'?'GUN GAME // DRONE GAUNTLET':'FREE-FOR-ALL // DRONE TRIAL');
  text('net-status','LOCAL SESSION');toggle('round-banner',false);toggle('cursor-prompt',false);
  alert(mode==='gun-game'?'GUN GAME // 7 LOADOUTS. EACH ELIMINATION ADVANCES.':'ESTABLISH UPLINK // ELIMINATE DRONES');
}
function goMenu():void{
  leaveOnline();game.quit();menu.hidden=false;pause.hidden=true;resultsEl.hidden=true;settingsEl.hidden=true;
  onlineMenu.hidden=true;toggle('hud',false);board.hidden=true;toggle('cursor-prompt',false);showRecords();
}
function showResults(data:Results):void {
  toggle('hud',false);pause.hidden=true;resultsEl.hidden=false;document.body.classList.remove('scoped');
  text('results-title',data.won?(game.gameMode==='gun-game'?'ARSENAL MASTERED':'SIGNAL SECURED'):'TRIAL COMPLETE');
  text('results-detail',data.won?'ELIMINATION THRESHOLD REACHED':'OPERATION WINDOW CLOSED');
  text('r-kills',data.score.kills);text('r-deaths',data.score.deaths);
  text('r-accuracy',`${accuracy(data.score)}%`);text('r-streak',data.score.bestStreak);
  text('r-time',formatTime(data.score.elapsed));text('r-xp',`+${data.xp}`);
  records={best:Math.max(records.best,data.score.kills),trials:records.trials+1,xp:records.xp+data.xp};
  try{localStorage.setItem(storeKey,JSON.stringify(records));}catch{/* Local save optional */}
}
function openSettings(origin:'menu'|'pause'):void {
  previousOverlay=origin;menu.hidden=true;pause.hidden=true;settingsEl.hidden=false;
  const sens=el<HTMLInputElement>('sensitivity'),fov=el<HTMLInputElement>('fov'),volume=el<HTMLInputElement>('volume');
  sens.value=String(settings.sensitivity);fov.value=String(settings.fov);volume.value=String(settings.volume*100);
  el<HTMLSelectElement>('quality').value=settings.quality;
  el<HTMLInputElement>('motion').checked=settings.reducedMotion;
  updateLabels();
}
function updateLabels():void{
  text('sensitivity-display',Number(el<HTMLInputElement>('sensitivity').value).toFixed(2));
  text('fov-display',`${el<HTMLInputElement>('fov').value}°`);
  text('volume-display',`${el<HTMLInputElement>('volume').value}%`);
}
for(const id of ['sensitivity','fov','volume'])el<HTMLInputElement>(id).addEventListener('input',updateLabels);
function closeSettings():void{
  settings={sensitivity:Number(el<HTMLInputElement>('sensitivity').value),fov:Number(el<HTMLInputElement>('fov').value),
    volume:Number(el<HTMLInputElement>('volume').value)/100,quality:el<HTMLSelectElement>('quality').value as Quality,
    reducedMotion:el<HTMLInputElement>('motion').checked};
  saveSettings(settings);game.applySettings(settings);settingsEl.hidden=true;
  if(previousOverlay==='pause')pause.hidden=false;else menu.hidden=false;
}

const game=new Game(el('viewport'),settings,{
  hud,
  elimination(name){alert(`SIGNAL DISRUPTED +75 // ${name}`);addFeed(`YOU / ${name} ✕`);},
  damage(){const v=el('damage-vignette');v.classList.remove('pulse');void v.offsetWidth;v.classList.add('pulse');},
  hit(kill){const marker=el('hitmarker');marker.classList.remove('show','kill');void marker.offsetWidth;marker.classList.add('show');if(kill)marker.classList.add('kill');},
  rankUp(name,stage){alert(`LOADOUT ${stage+1} UNLOCKED // ${name}`);addFeed(`LEVEL UP / ${name}`);},
  results(data){showResults(data);},
  paused(){toggle('pause',true);toggle('hud',false);toggle('cursor-prompt',false);},
  onlineFire(weapon){net.send({type:'fire',weapon});},
  onlineReload(weapon){net.send({type:'reload',weapon});},
  onlineMove(x,y,z,yaw,pitch,weapon){net.send({type:'move',x,y,z,yaw,pitch,weapon});},
  onlineRespawn(){net.send({type:'respawn'});},
});
const board=document.createElement('div');board.id='scoreboard';board.hidden=true;
board.innerHTML='<div class="eyebrow">LIVE MATCH / RELAY NINE</div><h2>TACTICAL TELEMETRY</h2><div id="board-rows"></div><p>HOLD TAB — VIEW MATCH</p>';
document.body.appendChild(board);
function renderScoreboard():void{
  const rows=el('board-rows');rows.replaceChildren();
  if(game.session==='online'){
    const ranked=[...game.onlinePlayers].sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths);
    for(const p of ranked){const row=document.createElement('div');row.className='online-score-row';
      row.textContent=`${p.id===net.id?'▶ ':''}${p.name}     ${p.kills} ELIMS    ${p.deaths} LOSSES${game.gameMode==='gun-game'?` · STAGE ${p.stage+1}`:''}${!p.alive?' • RESPAWNING':''}`;
      rows.appendChild(row);
    }
    if(!ranked.length)rows.textContent='AWAITING OPERATORS';
  }else rows.textContent=`OPERATOR  ${game.score.kills} ELIMS  ${game.score.deaths} LOSSES  ${accuracy(game.score)}% ACCURACY`;
}
window.addEventListener('keydown',e=>{
  if(e.code==='Tab'&&game.mode==='playing'){e.preventDefault();board.hidden=false;renderScoreboard();}
  if(e.code==='Escape'&&game.mode==='playing'&&document.pointerLockElement!==game.renderer.domElement)game.pause();
});
window.addEventListener('keyup',e=>{if(e.code==='Tab')board.hidden=true;});

net.onWelcome=(self:NetPlayer,mode:GameMode)=>{
  wasOnline=true;lastOnlineRound='waiting';showGame();el('kill-feed').replaceChildren();game.startOnline(self,mode);
  text('match-label',`ONLINE ${mode==='gun-game'?'GUN GAME':'FFA'} // ROOM ${net.room}`);
  text('net-status',`ONLINE • ${net.room}`);
  history.replaceState(null,'',`${window.location.pathname}?room=${encodeURIComponent(net.room)}`);
  toggle('round-banner',true);
  text('round-banner','WAITING FOR ANOTHER OPERATOR');
  toggle('cursor-prompt',document.pointerLockElement!==game.renderer.domElement);
  onlineStatus.textContent='CONNECTED';
};
net.onSnapshot=packet=>{
  if(!wasOnline)return;
  game.setOnlineSnapshot(packet.players,packet.remaining,packet.round,packet.mode);
  const count=packet.players.length;
  text('net-status',`${count}/8 OPERATORS • ${net.room}`);
  if(packet.round!==lastOnlineRound){
    if(packet.round==='playing'){alert('ROUND LIVE // ENGAGE');game.weapon.reset();if(packet.mode==='gun-game')game.weapon.select(GUN_GAME_ORDER[0]);}
    if(packet.round==='finished')alert('ROUND COMPLETE // NEXT ROUND SOON');
    lastOnlineRound=packet.round;
  }
  toggle('round-banner',packet.round!=='playing');
  text('round-banner',packet.round==='waiting'?'WAITING FOR OPPONENTS • SHARE ROOM CODE':`ROUND FINISHED • NEXT ROUND SOON`);
  if(!board.hidden)renderScoreboard();
};
net.onShot=packet=>game.playNetworkShot(packet);
net.onHit=packet=>{
  if(!wasOnline)return;
  const marker=el('hitmarker');marker.classList.remove('show','kill');void marker.offsetWidth;
  marker.classList.add('show');if(packet.kill)marker.classList.add('kill');
  game.audio.hit();if(packet.kill)game.audio.eliminate();
};
net.onFeed=packet=>{addFeed(`${packet.attacker} / ${packet.victim} ✕`);};
net.onRoundEnd=packet=>{addFeed(`ROUND WINNER: ${packet.winner}`);alert(`ROUND WINNER // ${packet.winner}`);};
net.onStatus=(message,ended)=>{
  onlineStatus.textContent=message;
  if(ended&&wasOnline){
    game.pause();goMenu();openOnlineMenu();onlineStatus.textContent=message;
  }
};

function openOnlineMenu():void {
  menu.hidden=true;onlineMenu.hidden=false;onlineStatus.textContent='JOIN AN EXISTING ROOM OR CREATE ONE';
  const fromUrl=cleanRoom(new URLSearchParams(location.search).get('room')??'');
  if(fromUrl)el<HTMLInputElement>('room-code').value=fromUrl;
  const inviteMode=new URLSearchParams(location.search).get('mode');
  if(inviteMode==='gun-game')el<HTMLSelectElement>('room-mode').value='gun-game';
}
function connectOnline():void {
  const name=cleanName(el<HTMLInputElement>('operator-name').value);
  const room=cleanRoom(el<HTMLInputElement>('room-code').value);
  if(room.length<3){onlineStatus.textContent='ROOM CODE MUST BE AT LEAST 3 CHARACTERS';return;}
  el<HTMLInputElement>('operator-name').value=name;
  try{localStorage.setItem('echofront.operator',name);}catch{/* optional */}
  onlineStatus.textContent='CONNECTING TO RELAY…';
  net.connect(room,name,el<HTMLSelectElement>('room-mode').value as GameMode);
}
try{el<HTMLInputElement>('operator-name').value=cleanName(localStorage.getItem('echofront.operator')??'OPERATOR');}catch{/* optional */}
const suggested=cleanRoom(new URLSearchParams(location.search).get('room')??'');
if(suggested){el<HTMLInputElement>('room-code').value=suggested;}
if(new URLSearchParams(location.search).get('mode')==='gun-game')el<HTMLSelectElement>('room-mode').value='gun-game';
el('online-btn').addEventListener('click',openOnlineMenu);
el('online-back').addEventListener('click',()=>{net.close();onlineMenu.hidden=true;menu.hidden=false;});
el('online-join').addEventListener('click',connectOnline);
el('online-create').addEventListener('click',()=>{
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const bytes=crypto.getRandomValues(new Uint8Array(6));
  el<HTMLInputElement>('room-code').value=Array.from(bytes,n=>alphabet[n%alphabet.length]).join('');
  connectOnline();
});
el('copy-room').addEventListener('click',()=>{
  const room=cleanRoom(el<HTMLInputElement>('room-code').value);
  if(room.length<3){onlineStatus.textContent='ENTER A ROOM CODE FIRST';return;}
  const link=`${location.origin}${location.pathname}?room=${encodeURIComponent(room)}&mode=${el<HTMLSelectElement>('room-mode').value}`;
  void navigator.clipboard.writeText(link).then(()=>{onlineStatus.textContent='INVITE LINK COPIED';},()=>{onlineStatus.textContent=link;});
});
el('cursor-prompt').addEventListener('click',()=>game.input.lock());
document.addEventListener('pointerlockchange',()=>{
  if(game.mode==='playing')toggle('cursor-prompt',document.pointerLockElement!==game.renderer.domElement&&pause.hidden);
});

el('play-btn').addEventListener('click',()=>start('ffa'));
el('play-gungame-btn').addEventListener('click',()=>start('gun-game'));
el('resume-btn').addEventListener('click',()=>{pause.hidden=true;toggle('hud',true);game.resume();});
el('quit-btn').addEventListener('click',goMenu);
el('again-btn').addEventListener('click',()=>start(game.gameMode));
el('results-menu-btn').addEventListener('click',goMenu);
el('settings-btn').addEventListener('click',()=>openSettings('menu'));
el('pause-settings-btn').addEventListener('click',()=>openSettings('pause'));
el('settings-close').addEventListener('click',closeSettings);
window.addEventListener('error',event=>console.error('ECHOFRONT error',event.error||event.message));
