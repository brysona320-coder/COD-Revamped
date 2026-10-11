import test from 'node:test';
import assert from 'node:assert/strict';
// Three.js is a production dependency. Tests here use pure rules while the visual integration
// is checked via the normal browser launch / production build.
import { clamp } from '../src/game/Settings.ts';
test('settings values are bounded', () => { assert.equal(clamp(-5, 0, 1), 0); assert.equal(clamp(9, 0, 1), 1); });
