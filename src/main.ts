import './style.css';
import { Game, type HudData, type Results } from './game/Game';
import { loadSettings, saveSettings, type Quality, type Settings } from './game/Settings';
import { accuracy, formatTime, MATCH_DURATION, SCORE_LIMIT } from './game/Rules';

const el = <T extends HTMLElement = HTMLElement>(id:string):T => {
  const node=document.getElementById(id);if(!node)throw new Error(`Missing UI element #${id}`);return node as T;
};
const toggle=(id:string,show:boolean)=>{el(id).hidden=!show;};
const text=(id:string,value:string|number)=>{el(id).textContent=String(value);};
const menu=el('menu'),pause=el('pause'),settingsEl=el('settings'),resultsEl=el('results');
const minimap=el<HTMLCanvasElement>('minimap');
const ctx=minimap.getContext('2d');
let settings=loadSettings();
let previousOverlay:'menu'|'pause'='menu';
let alertTimeout=0;
let vignette=0;

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
function drawMap(data:HudData):void{
  if(!ctx)return;
  const w=minimap.width,h=minimap.height,scale=1.82;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='rgba(7,19,30,.88)';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='rgba(90,180,182,.13)';ctx.lineWidth=1;
  for(let t=0;t<=w;t+=22){ctx.beginPath();ctx.moveTo(t,0);ctx.lineTo(t,h);ctx.stroke();ctx.beginPath();ctx.moveTo(0,t);ctx.lineTo(w,t);ctx.stroke();}
  const world=game.world;
  ctx.save();ctx.translate(w/2,h/2);
  for(const o of world.colliders){
    const x=(o.minX-data.playerX)*scale,y=(o.minZ-data.playerZ)*scale;
    ctx.fillStyle='rgba(99,131,143,.36)';ctx.fillRect(x,y,(o.maxX-o.minX)*scale,(o.maxZ-o.minZ)*scale);
  }
  for(const bot of data.bots){if(!bot.alive)continue;
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
  text('match-time',data.time);text('match-score',`${String(data.kills).padStart(2,'0')} / ${SCORE_LIMIT}`);
  text('weapon-name',data.weapon);text('ammo-current',data.ammo);text('ammo-reserve',data.reserve);
  text('weapon-state',data.reloading>0?'RELOADING…':`PULSE MODE · R RELOAD · 1 / 2 SWITCH`);
  text('fps',`${Math.min(999,data.fps)} FPS`);
  toggle('respawn',data.respawn>0);
  if(data.respawn>0)text('respawn-seconds',Math.ceil(data.respawn));
  document.body.classList.toggle('aiming',data.aiming);
  drawMap(data);
}

const game=new Game(el('viewport'),settings,{
  hud,
  elimination(name){alert(`SIGNAL DISRUPTED  +75  //  ${name}`);const feed=el('kill-feed');
    const item=document.createElement('div');item.className='feed-item';item.textContent=`YOU  /  ${name}  ✕`;feed.prepend(item);
    while(feed.children.length>4)feed.lastElementChild?.remove();setTimeout(()=>item.remove(),4800);
  },
  damage(){const vignetteEl=el('damage-vignette');vignetteEl.classList.remove('pulse');void vignetteEl.offsetWidth;vignetteEl.classList.add('pulse');vignette++;},
  hit(kill){const marker=el('hitmarker');marker.classList.remove('show','kill');void marker.offsetWidth;marker.classList.add('show');if(kill)marker.classList.add('kill');},
  results(data){showResults(data);},
  paused(){toggle('pause',true);toggle('hud',false);},
});
// Deliberately inspect state in the scoreboard, without creating an inactive Tab key.
const board=document.createElement('div');board.id='scoreboard';board.hidden=true;board.innerHTML='<div class="eyebrow">LIVE MATCH / OFFLINE TRIAL</div><h2>TACTICAL TELEMETRY</h2><div id="board-rows"></div><p>TAB — CLOSE</p>';
document.body.appendChild(board);
window.addEventListener('keydown',e=>{
  if(e.code==='Tab'&&game.mode==='playing'){
    e.preventDefault();board.hidden=false;
    const score=game.score;
    el('board-rows').textContent=`OPERATOR  ${score.kills} ELIMINATIONS   ${score.deaths} LOSSES   ${accuracy(score)}% ACCURACY`;
  }
  if(e.code==='Escape'&&game.mode==='playing'&&document.pointerLockElement!==game.renderer.domElement)game.pause();
});
window.addEventListener('keyup',e=>{if(e.code==='Tab')board.hidden=true;});

function showGame():void {menu.hidden=true;pause.hidden=true;resultsEl.hidden=true;settingsEl.hidden=true;toggle('hud',true);board.hidden=true;}
function start():void {showGame();el('kill-feed').replaceChildren();game.start();alert('ESTABLISH UPLINK  //  ELIMINATE DRONES');}
function goMenu():void{game.quit();menu.hidden=false;pause.hidden=true;resultsEl.hidden=true;settingsEl.hidden=true;toggle('hud',false);board.hidden=true;showRecords();}
function showResults(data:Results):void {
  toggle('hud',false);pause.hidden=true;resultsEl.hidden=false;
  text('results-title',data.won?'SIGNAL SECURED':'TRIAL COMPLETE');
  text('results-detail',data.won?'ELIMINATION THRESHOLD REACHED':'OPERATION WINDOW CLOSED');
  text('r-kills',data.score.kills);text('r-deaths',data.score.deaths);
  text('r-accuracy',`${accuracy(data.score)}%`);text('r-streak',data.score.bestStreak);
  text('r-time',formatTime(data.score.elapsed));text('r-xp',`+${data.xp}`);
  records={best:Math.max(records.best,data.score.kills),trials:records.trials+1,xp:records.xp+data.xp};
  try{localStorage.setItem(storeKey,JSON.stringify(records));}catch{/* local-only and optional */}
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
el('play-btn').addEventListener('click',start);
el('resume-btn').addEventListener('click',()=>{pause.hidden=true;toggle('hud',true);game.resume();});
el('quit-btn').addEventListener('click',goMenu);
el('again-btn').addEventListener('click',start);
el('results-menu-btn').addEventListener('click',goMenu);
el('settings-btn').addEventListener('click',()=>openSettings('menu'));
el('pause-settings-btn').addEventListener('click',()=>openSettings('pause'));
el('settings-close').addEventListener('click',closeSettings);

// WebGL failure is surfaced instead of leaving a blank page.
window.addEventListener('error',event=>{console.error('ECHOFRONT error',event.error||event.message);});
void MATCH_DURATION;void vignette;
