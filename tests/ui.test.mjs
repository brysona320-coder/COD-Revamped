import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
test('all statically referenced UI elements exist',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,'Duplicate element ids');
  const required=[...main.matchAll(/\bel(?:<[^>]*>)?\(['"]([^'"]+)['"]/g)].map(m=>m[1]);
  for(const id of required){
    if(id==='board-rows')continue; // Injected at runtime by the scoreboard component.
    assert.ok(ids.includes(id),'Missing HTML element: '+id);
  }
});
test('multiplayer room menu is enabled and usable',()=>{
  assert.match(html,/<button id="online-btn"[^>]*>/);
  assert.doesNotMatch(html,/<button id="online-btn"[^>]*disabled/);
  assert.doesNotMatch(html,/OFFLINE BUILD/);
  for(const id of ['online-menu','online-create','online-join','copy-room','online-back','room-code','operator-name','online-status','net-status','round-banner','cursor-prompt'])
    assert.ok(html.includes('id="'+id+'"'),'Missing multiplayer control '+id);
});
