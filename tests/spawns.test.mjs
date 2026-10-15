import test from 'node:test';import assert from 'node:assert/strict';
import {ARENA_BOXES,START_CANDIDATES,canSpawn,selectSpawn,rayWallDistance} from '../src/shared/Arena.ts';
test('spawn locations are never inside buildings, barricades or containers',()=>{
  for(let seed=0;seed<100;seed++){
    const p=selectSpawn(ARENA_BOXES,[{x:8,z:10},{x:-4,z:-8}],seed);
    assert.equal(canSpawn(p.x,p.z,ARENA_BOXES,.8),true);
  }
});
test('invalid and wall-embedded spawns are rejected',()=>{
  assert.equal(canSpawn(-25,-25),false);assert.equal(canSpawn(100,0),false);
  assert.equal(canSpawn(NaN,0),false);
  assert.ok(START_CANDIDATES.length>10);
});
test('wall raycasting blocks sightlines through industrial buildings',()=>{
  const origin={x:-25,y:1.7,z:-42},dir={x:0,y:0,z:1};
  assert.ok(rayWallDistance(origin,dir,ARENA_BOXES)<30);
});
