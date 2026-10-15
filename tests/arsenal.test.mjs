import test from 'node:test';
import assert from 'node:assert/strict';
import {WEAPONS,BLADE_INDEX,GUN_GAME_ORDER,gunGameWeapon,scoreLimit} from '../src/shared/Arsenal.ts';
import {matchOver,newScore} from '../src/game/Rules.ts';

test('every fictional loadout has valid shared gameplay attributes',()=>{
  assert.equal(WEAPONS.length,7);
  assert.equal(new Set(WEAPONS.map(w=>w.id)).size,WEAPONS.length);
  for(const w of WEAPONS){
    assert.ok(w.damage>0 && w.fireInterval>0 && w.range>0);
    assert.ok(w.adsZoom>0 && w.adsZoom<=1);
    assert.ok(w.magazine>0 && w.reserve>=0 && w.reloadTime>=0);
  }
  assert.equal(WEAPONS[BLADE_INDEX].role,'melee');
  assert.equal(WEAPONS.filter(w=>w.role==='smg').length,2);
  assert.equal(WEAPONS.filter(w=>w.role==='sniper').length,1);
});
test('Gun Game is a deterministic seven-stage progression ending in the blade',()=>{
  assert.equal(new Set(GUN_GAME_ORDER).size,WEAPONS.length);
  assert.equal(GUN_GAME_ORDER.length,7);
  assert.equal(gunGameWeapon(0),GUN_GAME_ORDER[0]);
  assert.equal(gunGameWeapon(6),BLADE_INDEX);
  assert.equal(gunGameWeapon(100),BLADE_INDEX);
  assert.equal(gunGameWeapon(-10),GUN_GAME_ORDER[0]);
  for(let stage=0;stage<GUN_GAME_ORDER.length;stage++)assert.ok(WEAPONS[gunGameWeapon(stage)]);
});
test('Gun Game and FFA independently enforce their own victory limit',()=>{
  assert.equal(scoreLimit('gun-game'),7);
  assert.equal(scoreLimit('ffa'),25);
  assert.equal(matchOver({...newScore(),kills:7},scoreLimit('gun-game')),true);
  assert.equal(matchOver({...newScore(),kills:7},scoreLimit('ffa')),false);
});
