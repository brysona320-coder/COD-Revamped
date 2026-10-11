import * as THREE from 'three';

export interface Obstacle { minX: number; maxX: number; minZ: number; maxZ: number; height: number; }
export function circleTouchesBox(x: number, z: number, radius: number, o: Obstacle): boolean {
  const px = Math.max(o.minX, Math.min(x, o.maxX)); const pz = Math.max(o.minZ, Math.min(z, o.maxZ));
  return (x - px) ** 2 + (z - pz) ** 2 < radius ** 2;
}
export function canStand(x: number, z: number, feetY: number, obstacles: readonly Obstacle[], radius = 0.42): boolean {
  if (Math.abs(x) > 44 - radius || Math.abs(z) > 44 - radius) return false;
  return !obstacles.some(o => o.height > feetY + 0.08 && circleTouchesBox(x, z, radius, o));
}
export function moveWithCollision(position: THREE.Vector3, dx: number, dz: number, obstacles: readonly Obstacle[], radius = 0.42): void {
  if (canStand(position.x + dx, position.z, position.y, obstacles, radius)) { position.x += dx; position.z += dz; return; }
  if (canStand(position.x + dx, position.z, position.y, obstacles, radius)) position.x += dx;
  if (canStand(position.x, position.z + dz, position.y, obstacles, radius)) position.z += dz;
}
// Analytical ray/rectangle slab intersection in the XZ plane, for bot sight checks.
export function segmentBlocked(ax: number, az: number, bx: number, bz: number, boxes: readonly Obstacle[], minHeight = 1.3): boolean {
  const dx = bx - ax, dz = bz - az;
  return boxes.some(o => {
    if (o.height < minHeight) return false;
    let lo = 0, hi = 1;
    for (const [p, d, mn, mx] of [[ax, dx, o.minX, o.maxX], [az, dz, o.minZ, o.maxZ]]) {
      if (Math.abs(d) < 1e-8) { if (p < mn || p > mx) return false; }
      else { const a = (mn - p) / d, b = (mx - p) / d; lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b)); if (hi < lo) return false; }
    }
    return hi > 0.01 && lo < 0.99;
  });
}
export function findPath(sx: number, sz: number, tx: number, tz: number, obstacles: readonly Obstacle[]): THREE.Vector3[] {
  const step = 3.6, half = 12; const size = half * 2 + 1;
  const toCell = (n: number) => Math.max(0, Math.min(size - 1, Math.round(n / step) + half));
  const cellId = (x: number, z: number) => z * size + x;
  const x0 = toCell(sx), z0 = toCell(sz), x1 = toCell(tx), z1 = toCell(tz);
  const start = cellId(x0, z0), end = cellId(x1, z1);
  const open: number[] = [start]; const visited = new Set<number>(); const came = new Map<number, number>();
  const g = new Map<number, number>([[start, 0]]);
  const h = (id: number) => Math.abs(id % size - x1) + Math.abs(Math.floor(id / size) - z1);
  let budget = 320;
  while (open.length && budget-- > 0) {
    open.sort((a,b) => ((g.get(a) ?? 1e9) + h(a)) - ((g.get(b) ?? 1e9) + h(b)));
    const id = open.shift()!; if (id === end) break;
    if (visited.has(id)) continue; visited.add(id);
    const cx = id % size, cz = Math.floor(id / size);
    for (const [ox, oz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = cx + ox, nz = cz + oz;
      if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
      const wx = (nx - half) * step, wz = (nz - half) * step;
      if (!canStand(wx, wz, 0, obstacles, 0.65)) continue;
      const ni = cellId(nx, nz), next = (g.get(id) ?? 0) + 1;
      if (next < (g.get(ni) ?? Infinity)) { came.set(ni, id); g.set(ni, next); open.push(ni); }
    }
  }
  if (!came.has(end)) return [new THREE.Vector3(tx, 0, tz)];
  const points: THREE.Vector3[] = []; let current = end; let count = 0;
  while (current !== start && count++ < 200) {
    points.push(new THREE.Vector3((current % size - half) * step, 0, (Math.floor(current / size) - half) * step));
    current = came.get(current) ?? start;
  }
  return points.reverse();
}
