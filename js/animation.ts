// General animation helper. The scenery, animals and lesson panels are 3D (world3d, creatures3d,
// lesson3d).

// Calls fn(t), t = 0..1, on every frame for `duration` milliseconds.
export function animate(duration: number, fn: (t: number) => void): Promise<void> {
  return new Promise<void>((resolve) => {
    const start = performance.now();
    function step(now: number) {
      const t = Math.min((now - start) / duration, 1);
      fn(t);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}
