import assert from 'node:assert/strict';
import test from 'node:test';
import { overlayPosition } from '../src/lib/overlayPosition.js';

const viewport = { width: 1000, height: 600 };
const panel = { width: 150, height: 190 };

test('opens below with space and aligns to the trigger', () => {
  assert.deepEqual(overlayPosition({ top: 100, bottom: 140, right: 900 }, panel, viewport), { left: 750, top: 148, maxHeight: 444 });
});

test('last-row disclosure flips above and stays inside the viewport', () => {
  const result = overlayPosition({ top: 550, bottom: 590, right: 1010 }, panel, viewport);
  assert.equal(result.left, 842);
  assert.equal(result.top, 352);
  assert.ok(result.top + panel.height < 550);
});

test('constrains a tall disclosure on a short mobile viewport', () => {
  const result = overlayPosition({ top: 190, bottom: 230, right: 100 }, panel, { width: 320, height: 260 });
  assert.deepEqual(result, { left: 8, top: 8, maxHeight: 174 });
});

test('keeps the menu visible when scrolling moves its trigger offscreen', () => {
  for (const top of [-300, 900]) {
    const result = overlayPosition({ top, bottom: top + 40, right: 900 }, panel, viewport);
    assert.ok(result.top >= 8);
    assert.ok(result.top + Math.min(panel.height, result.maxHeight) <= viewport.height - 8);
  }
});
