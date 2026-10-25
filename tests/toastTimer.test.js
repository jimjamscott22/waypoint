import assert from 'node:assert/strict';
import test from 'node:test';
import { createToastTimer } from '../src/lib/toastTimer.js';

function clock() {
  let time = 0;
  let nextId = 0;
  const tasks = new Map();
  return {
    now: () => time,
    schedule: (callback, delay) => { const id = ++nextId; tasks.set(id, { callback, due: time + delay }); return id; },
    cancel: id => tasks.delete(id),
    tick: duration => {
      time += duration;
      for (const [id, task] of tasks) {
        if (task.due <= time) { tasks.delete(id); task.callback(); }
      }
    },
  };
}

test('expires after six active seconds', () => {
  const time = clock();
  let expired = 0;
  createToastTimer(() => expired++, 6000, time);
  time.tick(5999);
  assert.equal(expired, 0);
  time.tick(1);
  assert.equal(expired, 1);
});

test('hover and focus both have to end, then only the remaining time runs', () => {
  const time = clock();
  let expired = 0;
  const timer = createToastTimer(() => expired++, 6000, time);
  time.tick(2000);
  timer.pause('pointer');
  timer.pause('pointer');
  timer.pause('focus');
  time.tick(10000);
  timer.resume('pointer');
  time.tick(10000);
  assert.equal(expired, 0);
  timer.resume('focus');
  timer.resume('focus');
  time.tick(3999);
  assert.equal(expired, 0);
  time.tick(1);
  assert.equal(expired, 1);
});

test('disposing an old toast cancels expiry and prevents rescheduling', () => {
  const time = clock();
  let expired = 0;
  const timer = createToastTimer(() => expired++, 6000, time);
  timer.pause('focus');
  timer.dispose();
  timer.resume('focus');
  time.tick(10000);
  assert.equal(expired, 0);
});
