// ---------- pure maths (no DOM / three dependency; also runs in node for the checks) ----------
const PI = Math.PI, TAU = PI * 2, D2R = PI / 180;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const sat = x => x < 0 ? 0 : x > 1 ? 1 : x;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = sat(t); return t * t * (3 - 2 * t); };
const smoother = t => { t = sat(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const ss = (a, b, x) => smooth((x - a) / (b - a));
const sss = (a, b, x) => smoother((x - a) / (b - a));
// heavy machine ease: slow start, fast, hard stop (the slam)
const slam = t => { t = sat(t); return t < .82 ? Math.pow(t / .82, 2.4) * .985 : lerp(.985, 1, smooth((t - .82) / .18)); };
const easeOut = t => { t = sat(t); return 1 - Math.pow(1 - t, 3); };
const easeIn = t => { t = sat(t); return t * t * t; };
const hash1 = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); };
const hash2 = (a, b) => { const s = Math.sin(a * 127.1 + b * 269.5 + 17.3) * 43758.5453123; return s - Math.floor(s); };
function RNG(seed) {
  let s = (seed >>> 0) || 1;
  const f = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  f.range = (a, b) => a + (b - a) * f(); f.int = (a, b) => a + Math.floor(f() * (b - a + 1)); f.pick = a => a[Math.floor(f() * a.length)]; f.chance = p => f() < p; return f;
}
// vec3 as [x,y,z]
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vmul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const vmad = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vlen = a => Math.hypot(a[0], a[1], a[2]);
const vdist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const vnorm = a => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const vlerp = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
// quaternion [x,y,z,w]
const QI = [0, 0, 0, 1];
const qaxis = (ax, a) => { const s = Math.sin(a / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(a / 2)]; };
const qx = a => [Math.sin(a / 2), 0, 0, Math.cos(a / 2)], qy = a => [0, Math.sin(a / 2), 0, Math.cos(a / 2)], qz = a => [0, 0, Math.sin(a / 2), Math.cos(a / 2)];
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qconj = q => [-q[0], -q[1], -q[2], q[3]];
const qrot = (q, v) => { const x = q[0], y = q[1], z = q[2], w = q[3], tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]); return [v[0] + w * tx + y * tz - z * ty, v[1] + w * ty + z * tx - x * tz, v[2] + w * tz + x * ty - y * tx]; };
const qnorm = q => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };
function qslerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], s = 1; if (d < 0) { d = -d; s = -1; }
  if (d > .9995) return qnorm([lerp(a[0], b[0] * s, t), lerp(a[1], b[1] * s, t), lerp(a[2], b[2] * s, t), lerp(a[3], b[3] * s, t)]);
  const th = Math.acos(d), sn = Math.sin(th), A = Math.sin((1 - t) * th) / sn, B = Math.sin(t * th) / sn * s;
  return [a[0] * A + b[0] * B, a[1] * A + b[1] * B, a[2] * A + b[2] * B, a[3] * A + b[3] * B];
}
// quaternion from orthonormal basis columns
function qbasis(x, y, z) {
  const m00 = x[0], m10 = x[1], m20 = x[2], m01 = y[0], m11 = y[1], m21 = y[2], m02 = z[0], m12 = z[1], m22 = z[2], tr = m00 + m11 + m22; let s;
  if (tr > 0) { s = .5 / Math.sqrt(tr + 1); return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, .25 / s]; }
  if (m00 > m11 && m00 > m22) { s = 2 * Math.sqrt(1 + m00 - m11 - m22); return [.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  if (m11 > m22) { s = 2 * Math.sqrt(1 + m11 - m00 - m22); return [(m01 + m10) / s, .25 * s, (m12 + m21) / s, (m02 - m20) / s]; }
  s = 2 * Math.sqrt(1 + m22 - m00 - m11); return [(m02 + m20) / s, (m12 + m21) / s, .25 * s, (m10 - m01) / s];
}
const qeuler = (p, y, r) => qmul(qy(y), qmul(qx(p), qz(r)));
function qfromto(a, b) { const d = vdot(a, b); if (d > .99999) return QI.slice(); if (d < -.99999) { const o = Math.abs(a[0]) < .9 ? [1, 0, 0] : [0, 1, 0]; return qaxis(vnorm(vcross(a, o)), PI); } const c = vcross(a, b); return qnorm([c[0], c[1], c[2], 1 + d]); }
// rigid transform {p,q}
const XI = { p: [0, 0, 0], q: QI };
const xmul = (a, b) => ({ p: vadd(a.p, qrot(a.q, b.p)), q: qmul(a.q, b.q) });
const xpt = (a, v) => vadd(a.p, qrot(a.q, v));
const xinv = a => { const q = qconj(a.q); return { p: qrot(q, vmul(a.p, -1)), q }; };
const xabout = (pivot, q) => ({ p: vsub(pivot, qrot(q, pivot)), q }); // rotation q about a pivot point
const xlerp = (a, b, t) => ({ p: vlerp(a.p, b.p, t), q: qslerp(a.q, b.q, t) });
const xtr = p => ({ p, q: QI });
// keyframe track: keys [[t, v...], ...], cubic hermite with monotone tangents (no overshoot)
function track(keys) {
  const n = keys.length, m = keys[0].length - 1;
  const tan = keys.map((k, i) => { const r = []; for (let c = 1; c <= m; c++) { if (i === 0 || i === n - 1) { r.push(0); continue; } const a = keys[i - 1], b = keys[i + 1], d0 = (k[c] - a[c]) / (k[0] - a[0]), d1 = (b[c] - k[c]) / (b[0] - k[0]); r.push(d0 * d1 <= 0 ? 0 : 2 * d0 * d1 / (d0 + d1)); } return r; });
  return t => {
    if (t <= keys[0][0]) return keys[0].slice(1); if (t >= keys[n - 1][0]) return keys[n - 1].slice(1);
    let i = 0; while (t > keys[i + 1][0]) i++; const a = keys[i], b = keys[i + 1], h = b[0] - a[0], u = (t - a[0]) / h, u2 = u * u, u3 = u2 * u, out = new Array(m);
    for (let c = 0; c < m; c++) out[c] = (2 * u3 - 3 * u2 + 1) * a[c + 1] + (u3 - 2 * u2 + u) * h * tan[i][c] + (-2 * u3 + 3 * u2) * b[c + 1] + (u3 - u2) * h * tan[i + 1][c]; return out;
  };
}
// smooth pseudo noise 1D, C1
const noise1 = (x, s = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash2(i, s), hash2(i + 1, s), u) * 2 - 1; };
// two-bone IK. rest joints A0,B0,C0 and hinge axis h0 (unit). Returns joint B and the rigid skin transforms of both bones.
function ik2(A0, B0, C0, h0, A, C, pole, sgnRest, maxFrac) {
  const L1 = vdist(A0, B0), L2 = vdist(B0, C0), d = vsub(C, A), D = vlen(d), maxD = (L1 + L2) * (maxFrac || .9995);
  const Dc = clamp(D, Math.abs(L1 - L2) * 1.001 + .01, maxD), dir = vmul(d, 1 / (D || 1)), Ce = vmad(A, dir, Dc);
  const a = (L1 * L1 - L2 * L2 + Dc * Dc) / (2 * Dc), hh = Math.sqrt(Math.max(0, L1 * L1 - a * a)), p = vnorm(vmad(pole, dir, -vdot(pole, dir))), B = vadd(vmad(A, dir, a), vmul(p, hh));
  const hs = vmul(vnorm(vcross(dir, p)), sgnRest || 1);
  const fr = (a, b, hz) => { const y = vnorm(vsub(b, a)); const z = vnorm(vmad(hz, y, -vdot(hz, y))); return qbasis(vcross(y, z), y, z); };
  const q1 = qmul(fr(A, B, hs), qconj(fr(A0, B0, h0))), q2 = qmul(fr(B, Ce, hs), qconj(fr(B0, C0, h0)));
  return { B, C: Ce, x1: { p: vsub(A, qrot(q1, A0)), q: q1 }, x2: { p: vsub(B, qrot(q2, B0)), q: q2 } };
}
