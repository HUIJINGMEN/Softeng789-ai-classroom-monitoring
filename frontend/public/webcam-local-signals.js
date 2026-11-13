/* Local geometry only. This classic-worker helper has no network or storage APIs. */
function measureLocalFace(points, width, height, light) {
  const reject = reason => ({ left: null, right: null, reason });
  if (!points || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return reject('Face geometry unavailable');
  if (!light || !Number.isFinite(light.mean) || !Number.isFinite(light.contrast)) return reject('Lighting check unavailable');
  if (light.mean < 25 || light.mean > 240 || light.contrast < 8) return reject('Lighting or image contrast is insufficient');
  function eye(ids) {
    const p = ids.map(i => points[i]);
    if (p.some(v => !v || !Number.isFinite(v.x) || !Number.isFinite(v.y) || v.x < .01 || v.x > .99 || v.y < .01 || v.y > .99)) return null;
    const distance = (a, b) => Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
    const span = distance(p[0], p[1]);
    if (span < 16) return null;
    const ratio = (distance(p[2], p[3]) + distance(p[4], p[5])) / (2 * span);
    return Number.isFinite(ratio) && ratio >= 0 && ratio <= .65 ? ratio : null;
  }
  // MediaPipe eye contour pairs; use pixel dimensions to avoid aspect-ratio distortion.
  const left = eye([33, 133, 160, 144, 158, 153]);
  const right = eye([362, 263, 385, 380, 387, 373]);
  return { left, right, reason: left === null || right === null ? 'Eyes too small, clipped or geometry unavailable' : null };
}
