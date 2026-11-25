// ---------- robot skeleton: pose -> rigid bone transforms M (applied on top of bind space) ----------
for (const s of ['L', 'R']) { BONES.push('ank1' + s, 'ank2' + s, 'pad' + s); } BONES.forEach((b, i) => BI[b] = i);
const NB = BONES.length;
function newPose() {
  return { root: [0, 28, 0], rq: QI, raise: 1, abd: [J.leanA, 0, 0], chest: [J.leanC, 0, 0], head: [0, 0, 0], foot: [{ p: [179, 0, 0], q: QI }, { p: [-179, 0, 0], q: QI }], pole: [[1, 1, 0], [-1, 1, 0]],
    armW: [0, 0], hand: [[139, 22, 66], [-139, 22, 66]], elbow: [[0, -.35, -1], [0, -.35, -1]], align: [0, 0], curl: [0, 0], wrist: [[0, 0, 0], [0, 0, 0]], react: 0 };
}
const clonePose = p => JSON.parse(JSON.stringify(p));
function mixPose(a, b, t) {
  const m = (x, y) => typeof x === 'number' ? lerp(x, y, t) : x.map((e, i) => m(e, y[i])); const o = {};
  for (const k in a) { if (k === 'rq') o.rq = qslerp(a.rq, b.rq, t); else if (k === 'foot') o.foot = a.foot.map((f, i) => ({ p: vlerp(f.p, b.foot[i].p, t), q: qslerp(f.q, b.foot[i].q, t) })); else o[k] = m(a[k], b[k]); } return o;
}
// hinge that always opens away from the compressed edge, so stacked blocks never sink into each other
function edgeHinge(y, half, e) { // e = [pitch,yaw,roll]
  const [p, yw, r] = e; const pv = [(r > 0 ? -1 : 1) * half, y, (p > 0 ? 1 : -1) * half];
  return xmul(xmul(xabout([0, y, pv[2]], qx(p)), xabout([pv[0], y, 0], qz(r))), xabout([0, y, 0], qy(yw)));
}
const ANK = [0, 1].map(i => mirX(J.ankle, i ? -1 : 1));
function solveRobot(P, M) {
  M = M || new Array(NB);
  const set = (n, x) => { M[BI[n]] = x; };
  const root = { p: vsub(P.root, qrot(P.rq, [0, 28, 0])), q: P.rq }; set('pelvis', root);
  const rA = J.raiseA * P.raise, rC = (J.raiseC - J.raiseA) * P.raise;
  const abd = xmul(xmul(root, xtr([0, rA, 0])), edgeHinge(58, 45, P.abd)); set('abd', abd);
  const chest = xmul(xmul(abd, xtr([0, rC, 0])), edgeHinge(131, 45, P.chest)); set('chest', chest);
  set('head', xmul(chest, xmul(xtr([0, 4 * P.raise, 0]), edgeHinge(252, 13, P.head))));
  const info = { knee: [], elbow: [], wrist: [], shoulder: [], hip: [], ankle: [] };
  for (let i = 0; i < 2; i++) {
    const s = i ? -1 : 1, S = i ? 'R' : 'L', hip = xpt(root, mirX(J.hip, s)), f = P.foot[i], A0 = ANK[i], foot = xmul({ p: f.p, q: f.q }, xtr([-A0[0], 0, 0])); set('foot' + S, foot);
    const up = qrot(f.q, [0, 1, 0]); const A = xpt(foot, A0); let leg; const H0 = mirX(J.hip, s), K0 = mirX(J.knee, s);
    const atRest = Math.abs(P.root[1] - 28) < 1e-6 && vlen(vsub(hip, H0)) < 1e-6 && vlen(vsub(A, A0)) < 1e-6 && Math.abs(f.q[3]) > 1 - 1e-9;
    let Ae = A, ch = null;
    for (let it = 0; it < 5; it++) {
      leg = ik2(H0, K0, A0, [0, 0, 1], hip, Ae, P.pole[i], s, .955); const rel = qmul(qconj(f.q), leg.x2.q), upR = qrot(rel, [0, 1, 0]), tilt = Math.acos(clamp(upR[1], -1, 1)), hz = Math.hypot(upR[0], upR[2]) || 1, yawR = 2 * Math.atan2(rel[1], rel[3]);
      const sup = (Math.abs(upR[0]) + Math.abs(upR[2])) / hz * 29.5, lift = sup * Math.sin(tilt / 3) * 1.08 + .25 * sat(tilt * 8); ch = []; let pt = A;
      for (let k = 1; k <= 3; k++) { const q0 = qslerp(f.q, leg.x2.q, (k - 1) / 3), q = k === 3 ? leg.x2.q : qslerp(f.q, leg.x2.q, k / 3); pt = vmad(pt, vnorm(vadd(qrot(q0, [0, 1, 0]), qrot(q, [0, 1, 0]))), lift); ch.push({ p: pt, q }); if (k < 3) pt = vmad(pt, qrot(q, [0, 1, 0]), 14); }
      Ae = vmad(ch[2].p, qrot(leg.x2.q, [0, 1, 0]), -28);
    }
    if (atRest) { leg.x1 = XI; leg.x2 = XI; }
    set('thigh' + S, leg.x1); set('shin' + S, leg.x2);
    if (atRest) { set('ank1' + S, XI); set('ank2' + S, XI); } else { const x = { p: vsub(ch[2].p, qrot(leg.x2.q, [A0[0], 52, 0])), q: leg.x2.q }; set('shin' + S, x); for (const [n, k, y] of [['ank1', 0, 24], ['ank2', 1, 38]]) set(n + S, { p: vsub(ch[k].p, qrot(ch[k].q, [A0[0], y, 0])), q: ch[k].q }); }
    info.knee[i] = leg.B; info.hip[i] = hip; info.ankle[i] = A;
    // arms
    const S0 = mirX(JA.shoulder, s), E0 = mirX(JA.elbow, s), W0 = mirX(JA.wrist, s), w = P.armW[i]; let ua = XI, fa = XI; const SN = xpt(chest, mirX(J.shoulderC, s)); info.shoulder[i] = SN;
    if (w > 0) {
      const k = ik2(S0, E0, W0, [1, 0, 0], SN, P.hand[i], P.elbow[i], 1, .9995); const q1 = w < 1 ? qslerp(QI, k.x1.q, w) : k.x1.q; ua = { p: vsub(SN, qrot(q1, S0)), q: q1 }; const E = xpt(ua, E0), q2 = w < 1 ? qslerp(QI, k.x2.q, w) : k.x2.q; fa = { p: vsub(E, qrot(q2, E0)), q: q2 }; }
    set('uarm' + S, ua); set('farm' + S, fa);
    { const cq = qmul(chest.q, qx(-J.leanA - J.leanC)), rel = qmul(qconj(cq), ua.q), q = w > 0 ? qslerp(cq, ua.q, .16) : QI; const up = qrot(rel, [0, 1, 0]), tl = Math.hypot(up[0], up[2]), wv = sat(w * 5); const c = xpt(ua, S0), off = vadd(vmul(qrot(q, [0, 1, 0]), 28 * tl * wv), vmul(qrot(q, [s, 0, 0]), 9 * tl * wv)); set('pad' + S, w > 0 ? { p: vadd(vsub(c, qrot(q, S0)), off), q } : XI); } info.elbow[i] = xpt(ua, E0);
    const al = P.align[i], wr = P.wrist[i], hand = xmul(fa, xmul(xtr([0, -25 * smooth(al * 2), 0]), xabout(W0, qmul(qmul(qy(wr[1]), qx(PI / 2 * smooth((al - .4) / .6) + wr[0])), qz(wr[2]))))); set('hand' + S, hand); info.wrist[i] = xpt(hand, W0);
    const c = P.curl[i]; let z = ARM_Z + AH + .4;
    for (let g = 0; g < 4; g++) { let m = hand, zz = z; const amp = [1.35, 1.45, 1.1]; for (let k = 0; k < 3; k++) { m = xmul(m, xabout([s * ARM_X + (g - 1.5) * 11.6, .3, zz], qx(amp[k] * c * (1 - .04 * g)))); set('f' + S + g + k, m); zz += [17.4, 14.6, 12][k]; } }
    { let m = xmul(hand, xabout([s * (ARM_X - AH - 7.2), .2, ARM_Z - 8], qx(.5 * c))); set('f' + S + '40', m); m = xmul(m, xabout([s * (ARM_X - AH - 7.2), .2, ARM_Z + 10], qx(1.1 * c))); set('f' + S + '41', m); set('f' + S + '42', m); }
  }
  M.info = info; return M;
}
// lower slices / plates of each shin belong to the ankle discs
function bindAnkles() { for (const p of PIECES) if (p.bone.startsWith('shin')) { const y = p.asm.p[1], S = p.bone[4]; if (y < 38) p.bone = 'ank1' + S; else if (y < 52) p.bone = 'ank2' + S; p.bi = BI[p.bone]; } }
// standing guard pose at a place
function standPose(o = {}) {
  const P = newPose(); P.root = [0, 320, 6]; P.abd = [2 * D2R, 0, 0]; P.chest = [1 * D2R, 0, 0]; P.head = [2 * D2R, 0, 0]; P.pole = [[1, .6, 1.5], [-1, .6, 1.5]]; P.armW = [1, 1]; P.hand = [[176, 330, 150], [-176, 330, 150]]; P.elbow = [[.25, -.4, -1], [-.25, -.4, -1]]; P.align = [1, 1]; P.curl = [.85, .85]; return Object.assign(P, o);
}
const torsoX = P => { const root = { p: vsub(P.root, qrot(P.rq, [0, 28, 0])), q: P.rq }; const abd = xmul(xmul(root, xtr([0, J.raiseA * P.raise, 0])), edgeHinge(58, 45, P.abd)); return xmul(xmul(abd, xtr([0, (J.raiseC - J.raiseA) * P.raise, 0])), edgeHinge(131, 45, P.chest)); };
const shoulderOf = (P, i) => xpt(torsoX(P), mirX(J.shoulderC, i ? -1 : 1));
// pose during the transformation, tau 0..10
function assemblePose(t) {
  const P = newPose(), r = sss(TT.raise[0], TT.raise[1], t), l = sss(TT.lean[0], TT.lean[1], t), e = smoother((t - TT.stand[0]) / (TT.stand[1] - TT.stand[0]));
  P.raise = r; P.abd = [J.leanA * l, 0, 0]; P.chest = [J.leanC * l, 0, 0];
  if (t > TT.stand[0]) {
    const G = standPose(), a = sss(TT.stand[0] + .02, TT.stand[0] + .65, t), push = Math.sin(PI * e);
    P.root = [0, lerp(28, G.root[1], e), lerp(0, G.root[2], e) + 26 * push]; const u = sss(TT.stand[0] + .9, TT.stand[1], t);
    P.abd = [lerp(J.leanA, G.abd[0], u) + .05 * push, 0, 0]; P.chest = [lerp(J.leanC, G.chest[0], u) + .04 * push, 0, 0]; P.head = [lerp(0, G.head[0], u) + .22 * Math.sin(PI * sat((t - 7.3) / 2.2)), 0, 0];
    const pf = 1.5 * ss(.72, 1, e); P.pole = [[1, lerp(1, .6, e), pf], [-1, lerp(1, .6, e), pf]];
    P.armW = [a, a]; const th = .95 * smooth((t - TT.stand[0]) / .75) - .3 * ss(.6, 1, e), R = lerp(214, 158, ss(.5, 1, e)), ab = .16 * ss(.35, 1, e), ex = .2 * ss(.6, 1, e);
    P.elbow = [[ex, -.4, -1], [-ex, -.4, -1]]; for (const i of [0, 1]) { const S = shoulderOf(P, i), sg = i ? -1 : 1; P.hand[i] = [S[0] + sg * R * Math.sin(ab), S[1] - R * Math.cos(th) * Math.cos(ab), S[2] + R * Math.sin(th)]; if (P.hand[i][1] < 24 + 30 * a) P.hand[i][1] = 24 + 30 * a; }
    P.align = [sss(TT.stand[0] + .25, TT.stand[0] + 1.0, t), sss(TT.stand[0] + .25, TT.stand[0] + 1.0, t)]; const c = sss(TT.stand[0] + 1.0, TT.stand[0] + 1.9, t) * .9; P.curl = [c, c];
  }
  return P;
}
