import { GLASS_TYPES, buildProfile, makeFillTable } from './glass-profiles.js';
for (const t of GLASS_TYPES) {
  const p = buildProfile(t);
  const ft = makeFillTable(p.inner, p.fillTopY, p.capacityMl);
  const hs = [0, 0.25, 0.5, 0.75, 1].map((f) => ft.heightForMl(f * p.capacityMl).toFixed(3));
  const innerOk = p.inner.every(([r, y]) => Number.isFinite(r) && Number.isFinite(y) && r >= 0);
  const topY = p.outer[p.outer.length - 1][1];
  console.log(t.padEnd(15), 'pts', p.outer.length, 'top', topY.toFixed(2), 'vol', ft.totalVolume.toFixed(3), 'h@0/25/50/75/100%', hs.join(' '), innerOk ? 'ok' : 'BAD');
  const mono = hs.every((h, i) => i === 0 || +h >= +hs[i - 1]);
  if (!mono || !innerOk) process.exitCode = 1;
}
