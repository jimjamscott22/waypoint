// Independent pause reasons prevent leaving hover from restarting a focused toast.
export function createToastTimer(onExpire, duration, {
  now = () => performance.now(),
  schedule = (callback, delay) => setTimeout(callback, delay),
  cancel = timeout => clearTimeout(timeout),
} = {}) {
  let remaining = duration;
  let startedAt = now();
  let disposed = false;
  const paused = new Set();
  let timeout = schedule(onExpire, remaining);
  return {
    pause(reason) {
      if (disposed || paused.has(reason)) return;
      if (!paused.size) {
        remaining = Math.max(0, remaining - (now() - startedAt));
        cancel(timeout);
      }
      paused.add(reason);
    },
    resume(reason) {
      if (disposed || !paused.delete(reason) || paused.size) return;
      startedAt = now();
      timeout = schedule(onExpire, remaining);
    },
    dispose() {
      disposed = true;
      cancel(timeout);
    },
  };
}
