import test from 'node:test';
import assert from 'node:assert/strict';
import { newScore, registerKill, registerDeath, accuracy, matchOver, formatTime, scoreXP } from '../src/game/Rules.ts';

test('eliminations and streaks are tracked immutably', () => {
  const start = newScore(); const a = registerKill(registerKill(start)); const b = registerDeath(a);
  assert.equal(start.kills, 0); assert.equal(a.kills, 2); assert.equal(a.bestStreak, 2); assert.equal(b.streak, 0); assert.equal(b.bestStreak, 2);
});
test('time and score limits are enforced', () => {
  assert.equal(matchOver({ ...newScore(), kills: 24, elapsed: 299 }), false);
  assert.equal(matchOver({ ...newScore(), kills: 25 }), true);
  assert.equal(matchOver({ ...newScore(), elapsed: 300 }), true);
});
test('accurate reporting of HUD and local XP', () => {
  assert.equal(formatTime(61.1), '1:02'); assert.equal(formatTime(-1), '0:00');
  assert.equal(accuracy({ ...newScore(), hits: 3, shots: 4 }), 75);
  assert.equal(accuracy(newScore()), 0); assert.ok(scoreXP({ ...newScore(), kills: 2 }) > 100);
});
