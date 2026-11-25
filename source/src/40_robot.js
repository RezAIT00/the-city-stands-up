// ---------- the robot: every piece, its city pose, its robot pose and the rails / hinges between them ----------
// Bind space = world space with the robot in its deep squat at home (0,0,0), facing +z (the bay).
// Transformation time TAU runs 0..10 s. Pieces travel in bind space; afterwards a rigid bone transform M[bone] carries them.
const BONES = ['pelvis', 'abd', 'chest', 'head', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'uarmL', 'farmL', 'handL', 'uarmR', 'farmR', 'handR'];
for (const s of ['L', 'R']) for (let f = 0; f < 5; f++) for (let k = 0; k < 3; k++) BONES.push('f' + s + f + k);
const BI = {}; BONES.forEach((b, i) => BI[b] = i);
const sideName = s => s > 0 ? 'L' : 'R';
// assembly geometry
const TW = 28, LV = 14, PA = 31, PE = 44, AW = 22, APA = 25, APE = 36, AH = 23.5;
const J = { // bind-space joints for side s=+1 (x>0)
  hip: [114, 14, 0], knee: [146.5, 172.2, 0], ankle: [179, 24, 0],
  shoulderC: [139, 222, 22], // in chest bind space
  raiseA: 5, raiseC: 10, leanA: 9.5 * D2R, leanC: 9.5 * D2R, pivA: [0, 58, 45], pivC: [0, 131, 45], neck: [0, 254, 0],
};
// pre-stand torso motion: raise on the spine rails, then lean forward so the shoulders meet the standing arms
function torsoLean(r, l) {
  const A = xmul(xabout(vadd(J.pivA, [0, J.raiseA * r, 0]), qx(J.leanA * l)), xtr([0, J.raiseA * r, 0]));
  const C = xmul(A, xmul(xabout(vadd(J.pivC, [0, (J.raiseC - J.raiseA) * r, 0]), qx(J.leanC * l)), xtr([0, (J.raiseC - J.raiseA) * r, 0])));
  return { A, C };
}
const SH_W = xpt(torsoLean(1, 1).C, J.shoulderC); // where the shoulder lands in the squat
const ARM_Z = SH_W[2], ARM_X = J.shoulderC[0];
const JA = { shoulder: [ARM_X, SH_W[1], ARM_Z], elbow: [ARM_X, 22 + 8 * LV, ARM_Z + AH], wrist: [ARM_X, 22, ARM_Z] };
const mirX = (p, s) => [p[0] * s, p[1], p[2]];

const PIECES = []; let STADT = null;
const LANES = []; // for the rail geometry and the ground paint
const E01 = (t, a, b) => smoother((t - a) / (b - a));
const ES = (t, a, b) => slam((t - a) / (b - a));
function addPiece(o) { o.id = PIECES.length; o.seed = hash1(o.id * 1.37 + 3.1); o.large = Math.min(...o.dim) >= 1.2 && o.dim[0] * o.dim[1] * o.dim[2] >= 180; PIECES.push(o); return o; }
const TT = { // key times of the transformation (s)
  red: 0.0, rot: 0.35, shOut: [.95, 1.4], shUp: [1.45, 2.15], shIn: [2.25, 2.85], leaf: [1.2, 1.75], gather: [1.85, 2.6], lock: 2.62, armGather: [1.7, 2.4],
  thighSlide: [2.75, 3.5], shinSlide: [2.95, 3.8], armSlide: [2.45, 3.2], stadTilt: [1.1, 2.5], stadSlide: [2.75, 3.5], stadUp: [3.5, 4.5],
  raise: [6.55, 7.0], lean: [6.7, 7.25], stand: [7.25, 9.45], eyes: 9.3, end: 10 };

// ---- tower clusters -------------------------------------------------------
// a cluster gathers (exploded pitch -> assembled pitch) about its city centre, then slides on ground rails to its robot place
function Cluster(name, city, asm, pe, pa, gather, slide) {
  return { name, city, asm, pe, pa, at(i, j, t) { const g = E01(t, gather[0], gather[1]), m = slide ? E01(t, slide[0], slide[1]) : 0, p = lerp(pe, pa, g); return [lerp(city[0], asm[0], m) + i * p, lerp(city[1], asm[1], m) + j * p]; } };
}
// tower slice; phi = quarter turn still to do
function slicePhi(dir, t0, t) { return dir * (PI / 2) * (1 - E01(t, t0, t0 + .55)); }
function addSlice(cl, i, j, L, y0, w, h, bone, style, extra) {
  const dir = (hash2(i * 7.1 + L * 3.3, j * 5.7 + y0) > .5 ? 1 : -1) * (hash2(L + i, j + cl.city[0]) > .12 ? 1 : 2), t0 = TT.rot + L * .035 + hash2(L, i * 3 + j) * .22, y = y0 + h * (L + .5);
  const asm = { p: [cl.asm[0] + i * cl.pa, y, cl.asm[1] + j * cl.pa], q: QI }, rotOnly = extra && extra.noRot ? 0 : dir;
  return addPiece({ kind: 'slice', v: style, bone, dim: [w, h, w], asm, seedStyle: cl.name, end: 4.4, cl, ij: [i, j], L,
    path: t => { const c = cl.at(i, j, t); return { p: [c[0], y, c[1]], q: rotOnly ? qy(slicePhi(rotOnly, t0, t)) : QI }; }, phi: t => rotOnly ? slicePhi(rotOnly, t0, t) : 0 });
}
// something bolted to a tower face: offset is in the tower's final frame
function addFixed(cl, i, j, y, dim, off, bone, v, kind, qLocal = QI, phiFn, dyn) {
  const asmP = [cl.asm[0] + i * cl.pa + off[0], y + off[1], cl.asm[1] + j * cl.pa + off[2]];
  return addPiece({ kind, v, bone, dim, asm: { p: asmP, q: qLocal }, end: 5, cl, ij: [i, j],
    path: t => { const c = cl.at(i, j, t), ph = phiFn ? phiFn(t) : 0; let L = { p: off, q: qLocal }; if (dyn) L = dyn(t, L); const q = ph ? qy(ph) : QI, o = ph ? qrot(q, L.p) : L.p; return { p: [c[0] + o[0], y + o[1], c[1] + o[2]], q: ph ? qmul(q, L.q) : L.q }; } });
}
// road leaf: lies flat in the street, hinges up against the tower foot, then slides up the facade
function addLeaf(cl, i, j, dir, len, wid, bone, half, rise, riseT, v, lo) {
  // dir: 0 +x, 1 +z, 2 -x, 3 -z ; half = tower half width
  const a = dir === 0 ? [1, 0, 0] : dir === 1 ? [0, 0, 1] : dir === 2 ? [-1, 0, 0] : [0, 0, -1], th = 1.3, yaw = Math.atan2(a[0], a[2]), q0 = qy(yaw), h0 = half + .12, lt = TT.leaf, jit = hash2(i * 3 + dir, j + cl.city[0] * .1) * .18;
  const at = (t) => { const u = E01(t, lt[0] + jit, lt[1] + jit), ang = -u * PI / 2, r = riseT ? E01(t, riseT[0], riseT[1]) * rise : 0;
    // local z = outward. flat: centre at (0,-th/2,h0+wid/2). hinge on the edge (0,0,h0): the far edge rises until the road face meets the tower
    const c = Math.cos(u * PI / 2), s = Math.sin(u * PI / 2), z = wid / 2, yy = -th / 2; const lz = h0 + z * c - yy * s, ly = yy * c + z * s + .02;
    const L = [0, ly + r + (lo || 0) * 0, lz]; return { off: qrot(q0, L), q: qmul(q0, qx(ang)) }; };
  const fin = at(99), base = [cl.asm[0] + i * cl.pa, 0, cl.asm[1] + j * cl.pa];
  return addPiece({ kind: 'leaf', v: v || 'leaf', bone, dim: [len, th, wid], asm: { p: vadd(base, fin.off), q: fin.q }, end: 5, path: t => { const c = cl.at(i, j, t), o = at(t); return { p: [c[0] + o.off[0], o.off[1], c[1] + o.off[2]], q: o.q }; } });
}
// lock: a blade sign that folds flat, then swings 180 degrees across the seam between two towers and slams
function addLock(cl, i, j, face, sgn, y, half, bone, sliceP, tLock) {
  const w = 9, h = 6, th = 1.5, yaw = [PI / 2, 0, -PI / 2, PI][face], q0 = qy(yaw);
  // face-local: x along face (seam at sgn*(half+gap/2)), z outward
  const hingeX = sgn * (half + (cl.pa - half * 2) / 2), hz = half + .12 + th / 2;
  const loc = ang => { // ang 0 = flat on neighbour (locked), PI = flat on own face, PI/2 = blade
    const c = Math.cos(ang), s = Math.sin(ang); return { p: [hingeX + sgn * c * w / 2, 0, hz + s * w / 2], q: qy(-sgn * ang) }; };
  const toW = L => ({ p: qrot(q0, L.p), q: qmul(q0, L.q) });
  const fin = toW(loc(0)), yc = y;
  return addPiece({ kind: 'lock', v: 'lock', tLock, bone, dim: [w, h, th], asm: { p: [cl.asm[0] + i * cl.pa + fin.p[0], yc, cl.asm[1] + j * cl.pa + fin.p[2]], q: fin.q }, end: 4,
    path: t => { const c = cl.at(i, j, t), fold = E01(t, .05, .4), lk = ES(t, tLock, tLock + .32), ang = lerp(lerp(PI * .56, PI, fold), 0, lk), L = toW(loc(ang)), ph = sliceP ? sliceP.phi(t) : 0, q = ph ? qy(ph) : QI, o = ph ? qrot(q, L.p) : L.p; return { p: [c[0] + o[0], yc, c[1] + o[2]], q: ph ? qmul(q, L.q) : L.q }; } });
}
// ---- conveyor lanes: a street of buildings rolls along the ground, round a fillet and up the limb -------------
// wall point W=[x,z] on the limb face, n = outward normal [nx,nz], yg ground level, R fillet radius
function lanePose(W, n, yg, R, q, h, w) { // q: arc-length coordinate, 0 at the end of the fillet (wall side); returns centre pose of a piece standing on the rail
  const arc = R * PI / 2; let bx, by, ang;
  if (q >= 0) { ang = PI / 2; bx = 0; by = yg + R + q; } else if (q > -arc) { const th = (q + arc) / R; ang = th; bx = R - R * Math.sin(th); by = yg + R - R * Math.cos(th); } else { ang = 0; bx = R + (-arc - q); by = yg; }
  const c = Math.cos(ang), s = Math.sin(ang), ux = s, uy = c; // up vector = c*Y + s*n
  const yaw = Math.atan2(-n[0], -n[1]); // local z = -n (travel)
  return { p: [W[0] + n[0] * (bx + ux * h / 2), by + uy * h / 2, W[1] + n[1] * (bx + ux * h / 2)], q: qmul(qy(yaw), qx(-ang)) };
}
function addLane(o) { // {W,n,yg,R,g0,pitch,K,yTop,dy,w,L,hf(k),vf(k),bone(y),t0,T,dt}
  LANES.push(o); const arc = o.R * PI / 2;
  for (let k = 0; k < o.K; k++) {
    const h = o.hf(k), q0 = -arc - (o.g0 + k * o.pitch - o.R), y1 = o.yTop - k * o.dy - (o.skip && k >= o.skip[0] ? o.skip[1] : 0), q1 = y1 - o.yg - o.R, t0 = o.t0 + k * o.dt, T = o.T, kk = k;
    const path = t => lanePose(o.W, o.n, o.yg, o.R, lerp(q0, q1, smoother((t - t0) / T)), h, o.w);
    addPiece({ kind: o.kind || 'house', v: o.vf(kk, h), bone: o.bone(y1), dim: [o.w, h, o.L], asm: path(99), path, end: t0 + T, lane: LANES.length - 1 });
  }
}
// ---- trains -------------------------------------------------------------
function addTrain(o) { // like a lane but the car rides on two bogies, so it bends through the fillet
  LANES.push(Object.assign({ train: true }, o)); const arc = o.R * PI / 2, b = 5.2, h = 4.2;
  for (let k = 0; k < o.K; k++) {
    const q0 = -arc - (o.g0 + k * 16.6 - o.R), y1 = o.yTop - k * 16.6 - (o.skip && k >= o.skip[0] ? o.skip[1] : 0), q1 = y1 - o.yg - o.R, t0 = o.t0, T = o.T;
    const path = t => { const q = lerp(q0, q1, smoother((t - t0) / T)), A = lanePose(o.W, o.n, o.yg, o.R, q - b, h, 4), B = lanePose(o.W, o.n, o.yg, o.R, q + b, h, 4); const d = vnorm(vsub(B.p, A.p)), xw = vcross([0, 1, 0], [-o.n[0], 0, -o.n[1]]), y = vcross(d, xw); return { p: vmul(vadd(A.p, B.p), .5), q: qbasis(xw, y, d) }; };
    addPiece({ kind: 'train', v: k === 0 || k === o.K - 1 ? 'trainEnd' : 'train', bone: o.bone(y1), dim: [3.8, h, 15], asm: path(99), path, end: t0 + T, lane: LANES.length - 1, k });
  }
}

function buildPieces() {
  PIECES.length = 0; LANES.length = 0;
  const torsoBone = y => y < 56 ? 'pelvis' : y < 126 ? 'abd' : 'chest';
  // torso 5 x 3 towers, 18 slices
  const cT = Cluster('torso', [0, 0], [0, 0], PE, PA, TT.gather, null), sl = {};
  for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) for (let L = 0; L < 18; L++) {
    const b = torsoBone(L * LV + 7);
    if (Math.abs(i) === 2 && L >= 4 && L < 9) { // slides out of the tower, rides up the outside rails and becomes the shoulder block
      const s = Math.sign(i), dir = hash2(L, j) > .5 ? 1 : -1, t0 = TT.rot + L * .03, y = LV * (L + .5), up = 9 * LV - .0, d = (8 - L) * .05;
      const path = t => { const c = cT.at(i, j, t), o = E01(t, TT.shOut[0] + d, TT.shOut[1] + d), u = E01(t, TT.shUp[0] + d, TT.shUp[1] + d), n = E01(t, TT.shIn[0], TT.shIn[1]); const xo = lerp(c[0], s * 118.2, o); return { p: [lerp(xo, s * 93.2, n), y + up * u, c[1]], q: qy(slicePhi(dir, t0 - .1, t)) }; };
      addPiece({ kind: 'slice', v: 'coreD', bone: 'chest', dim: [TW, LV, TW], asm: path(99), path, end: 3, shoulder: true });
      continue;
    }
    sl[i + ',' + j + ',' + L] = addSlice(cT, i, j, L, 0, TW, LV, b, Math.abs(i) === 2 ? 'coreB' : i === 0 ? 'coreA' : 'coreC');
  }
  for (const s of [1, -1]) {
    const S = sideName(s), sx = x => x * s;
    // ---- legs
    const cTh = Cluster('thigh' + S, [sx(170), 0], [sx(114), 0], PE, PA, TT.gather, TT.thighSlide), cSh = Cluster('shin' + S, [sx(262), 0], [sx(179), 0], PE, PA, TT.gather, TT.shinSlide);
    for (const i of [-.5, .5]) for (const j of [-.5, .5]) {
      for (let L = 0; L < 10; L++) { sl['th' + s + i + j + L] = addSlice(cTh, i, j, L, 24, TW, LV, 'thigh' + S, j > 0 ? 'coreE' : 'coreB'); sl['sh' + s + i + j + L] = addSlice(cSh, i, j, L, 24, TW, LV, 'shin' + S, j > 0 ? 'coreF' : 'coreE'); }
      addFixed(cTh, i, j, 12, [TW, 24, TW], [0, 0, 0], 'thigh' + S, 'podium', 'podium'); addFixed(cSh, i, j, 12, [TW, 24, TW], [0, 0, 0], 'foot' + S, 'podium', 'podium');
      addFixed(cTh, i, j, 166.6, [11, 5, 13], [-s * 4, 0, 5 * Math.sign(j)], 'thigh' + S, 'gearA', 'roofgear'); addFixed(cSh, i, j, 166.6, [11, 5, 13], [s * 5, 0, 5 * Math.sign(j)], 'shin' + S, 'gearB', 'roofgear');
      addFixed(cSh, i, j, 165.6, [7, 3, 8], [s * 8, 0, -8 * Math.sign(j)], 'shin' + S, 'gearC', 'roofgear');
      if (i * s > 0) addFixed(cTh, i, j, 172.2, [16, 16, 13.4], [s * 17, 0, -7 * Math.sign(j)], 'thigh' + S, 'knuckle', 'knuckle', s > 0 ? QI : qy(PI)); else addFixed(cSh, i, j, 172.2, [16, 16, 13.4], [-s * 17, 0, 7 * Math.sign(j)], 'shin' + S, 'knuckle', 'knuckle', s > 0 ? qy(PI) : QI);
    }
    for (let k = 0; k < 3; k++) for (let m = 0; m < 3; m++) { // toes: three low terraces in front of the shin podium
      const x = sx(171.6 + k * 15.4), zc = 30.5 + 8.6 + m * 17.2, off = [x - cSh.asm[0], 0, zc], dim = [14.8, m === 2 ? 10 : 13, 16.6];
      addPiece({ kind: 'toe', v: m === 2 ? 'toeTip' : 'toe', bone: 'foot' + S, dim, asm: { p: [x, dim[1] / 2, zc], q: QI }, end: 3.9, path: t => { const c = cSh.at(0, 0, t); return { p: [c[0] + off[0], dim[1] / 2, zc + lerp(21, 0, E01(t, TT.gather[0], TT.gather[1]))], q: QI }; } });
    }
    for (const [cl, nm, st] of [[cTh, 'th', 'thigh'], [cSh, 'sh', 'shin']]) {
      for (const i of [-.5, .5]) for (const j of [-.5, .5]) { addLeaf(cl, i, j, i > 0 ? 2 : 0, 27, 7.6, st === 'thigh' ? 'thigh' + S : 'foot' + S, 14); addLeaf(cl, i, j, j > 0 ? 3 : 1, 27, 7.6, st === 'thigh' ? 'thigh' + S : 'foot' + S, 14); }
      for (const i of [-.5, .5]) { addLeaf(cl, i, .5, 1, 27.4, 11, st + S, 14, st === 'thigh' ? 108 : 112, [4.0, 4.8], 'leafB'); addLeaf(cl, i, -.5, 3, 27.4, 5, st + S, 14, 0, null, 'leaf'); }
      for (let L = 1; L < 10; L += 1) { const y = 24 + LV * L, tl = TT.lock + L * .045; const nmS = (i, j) => sl[nm + s + i + j + L];
        addLock(cl, -.5, .5, 1, 1, y + 7, 14, st + S, nmS(-.5, .5), tl); { addLock(cl, .5, -.5, 3, 1, y + 7, 14, st + S, nmS(.5, -.5), tl); const o = s > 0 ? 0 : 2; if (st === 'shin') addLock(cl, .5 * s, -.5, o, s > 0 ? -1 : 1, y + 7, 14, st + S, nmS(.5 * s, -.5), tl); } }
    }
    // ---- arms: one skyscraper cluster each, forearm below, upper arm above, the podium is the hand
    const cA = Cluster('arm' + S, [sx(191), 96], [sx(ARM_X), ARM_Z], APE, APA, TT.armGather, TT.armSlide);
    for (const i of [-.5, .5]) for (const j of [-.5, .5]) {
      for (let L = 0; L < 15; L++) sl['ar' + s + i + j + L] = addSlice(cA, i, j, L, 22, AW, LV, L < 8 ? 'farm' + S : 'uarm' + S, L < 8 ? 'armA' : 'armB');
      addFixed(cA, i, j, 11, [AW, 22, AW], [0, 0, 0], 'hand' + S, 'palm', 'podium');
      addFixed(cA, i, j, 232 + 11.7, [AW, 23, AW], [0, 0, 0], 'pad' + S, 'dome', 'crown', qy(i > 0 ? (j > 0 ? 0 : PI / 2) : (j > 0 ? -PI / 2 : PI)));
      addLeaf(cA, i, j, i > 0 ? 2 : 0, 21, 6.6, 'hand' + S, 11); addLeaf(cA, i, j, j > 0 ? 3 : 1, 21, 6.6, 'hand' + S, 11);
    }
    for (let L = 1; L < 15; L++) { const y = 22 + LV * L + 7, tl = TT.lock - .15 + L * .04, b = L < 8 ? 'farm' + S : 'uarm' + S; addLock(cA, -.5, .5, 1, 1, y, 11, b, sl['ar' + s + -.5 + .5 + L], tl); { addLock(cA, .5, -.5, 3, 1, y, 11, b, sl['ar' + s + .5 + -.5 + L], tl); const inn = s > 0 ? 2 : 0; addLock(cA, -.5 * s, -.5, inn, s > 0 ? 1 : -1, y, 11, b, sl['ar' + s + (-.5 * s) + -.5 + L], tl); } }
    // fingers: four rows of three buildings in front of the palm, hinged into fists later. thumb on the inner side
    const FL = [17.4, 14.6, 12];
    for (let f = 0; f < 4; f++) { let z = ARM_Z + AH + .4; for (let k = 0; k < 3; k++) { const len = FL[k], zc = z + len / 2, x = sx(ARM_X) + (f - 1.5) * 11.6, dim = [10.8 - k * .5, 11 - k * .8, len - .5]; z += len;
      addPiece({ kind: 'finger', v: 'finger' + k, bone: 'f' + S + f + k, dim, asm: { p: [x, dim[1] / 2, zc], q: QI }, end: 4.4, path: t => { const c = cA.at(0, 0, t); return { p: [c[0] + (f - 1.5) * lerp(13, 11.6, E01(t, 1.7, 2.4)), dim[1] / 2, c[1] + zc - ARM_Z + lerp(6 + k * 2, 0, E01(t, 1.7, 2.4))], q: QI }; } }); } }
    { let z = ARM_Z - 8; for (let k = 0; k < 2; k++) { const len = [18, 14][k], zc = z + len / 2, x = sx(ARM_X - AH - 7.2), dim = [11.5 - k, 11.5 - k, len - .5]; z += len; const dx = x - sx(ARM_X);
      addPiece({ kind: 'finger', v: 'finger' + k, bone: 'f' + S + '4' + k, dim, asm: { p: [x, dim[1] / 2, zc], q: QI }, end: 4.4, path: t => { const c = cA.at(0, 0, t), g = E01(t, 1.7, 2.4); return { p: [c[0] + dx - s * lerp(8, 0, g), dim[1] / 2, c[1] + zc - ARM_Z], q: QI }; } }); } }
    // ---- armour streets
    const bulge = (k, K, a, b) => a + b * Math.sin(PI * (k + .6) / (K + .4)), hq = (x, set) => set.reduce((p, c) => Math.abs(c - x) < Math.abs(p - x) ? c : p), H = [7, 9, 11, 13];
    for (let l = 0; l < 5; l++) { const o5 = (l - 2) * 11.9, mid = 1 - Math.abs(l - 2) * .22, r = k => (hash2(l * 3.7 + k, s + 5) - .5) * 3;
      addLane({ W: [sx(179 + 29.5 + 2.6), o5], n: [s, 0], yg: 0, R: 24, g0: 113, pitch: 20, K: 9, yTop: 158, dy: 12.1, w: 11.4, L: 11.2, hf: k => hq(bulge(k, 9, 6.5, 7) * mid + r(k), H), vf: (k, h) => 'house' + h + (l + k) % 3, bone: () => 'shin' + S, t0: 3.55 + Math.abs(l - 2) * .12, T: 2.15, dt: .045 });
      addLane({ W: [sx(179) + o5, -32.1], n: [0, -1], yg: 0, R: 24, g0: 46, pitch: 20, K: 9, yTop: 158, dy: 12.1, w: 11.4, L: 11.2, hf: k => hq(bulge(k, 9, 6, 8) * mid + r(k), H), vf: (k, h) => 'house' + h + (l + k + 1) % 3, bone: () => 'shin' + S, t0: 3.7 + Math.abs(l - 2) * .12, T: 1.95, dt: .062 });
      addLane({ W: [sx(114) + o5, -32.1], n: [0, -1], yg: 0, R: 24, g0: 46, pitch: 20, K: 11, yTop: 158, dy: 12.1, w: 11.4, L: 11.2, hf: k => hq(bulge(k, 11, 6, 7) * mid + r(k), H), vf: (k, h) => 'house' + h + (l * 2 + k) % 3, bone: () => 'thigh' + S, t0: 3.6 + Math.abs(l - 2) * .1, T: 2.0, dt: .045 });
    }
    const HA = [8, 11, 14];
    for (let l = 0; l < 3; l++) { const o3 = (l - 1) * 15.4, mid = l === 1 ? 1 : .78, prof = k => k > 11 ? 8 : (k < 7 ? 7 + 6 * Math.sin(PI * (k + 1) / 8) : 7 + 8 * Math.sin(PI * (k - 6.2) / 8.5)) * mid + (hash2(l + k * 2.3, 9 + s) - .5) * 2;
      addLane({ W: [sx(ARM_X) + o3, ARM_Z + AH + 2.6], n: [0, 1], yg: 12.5, R: 26, g0: 152 - (ARM_Z + AH + 2.6), pitch: 21, K: 11, skip: [6, 28], yTop: 224, dy: 14, w: 14.8, L: 13, hf: k => hq(k > 8 || k === 5 || k === 6 ? 8 : k === 4 ? 10 : prof(k < 6 ? k : k + 2), HA), vf: (k, h) => 'shop' + h + (l + k) % 2, bone: y => y < 134 ? 'farm' + S : 'uarm' + S, t0: 4.2 + Math.abs(l - 1) * .12, T: 2.1, dt: .062 });
      addLane({ W: [sx(ARM_X + AH + 2.6), ARM_Z + o3], n: [s, 0], yg: 14.5, R: 26, g0: 148, pitch: 20, K: 13, yTop: 224, dy: 14, w: 14.8, L: 13, hf: k => hq(prof(k), HA), vf: (k, h) => 'shop' + h + (l + k + 1) % 2, bone: y => y < 134 ? 'farm' + S : 'uarm' + S, t0: 4.4 + Math.abs(l - 1) * .12, T: 2.2, dt: .062 });
    }
    for (let l = 0; l < 4; l++) addLane({ W: [sx(28.6 + l * 12.8), -47.6], n: [0, -1], yg: -3, R: 24, g0: 36, pitch: 19.5, K: 18, yTop: 240, dy: 12.6, w: 12.2, L: 11.6, kind: 'barge', hf: k => hq(7 + 5 * Math.sin(PI * (k + 2) / 19) + (hash2(l * 1.3 + k, s) - .5) * 3, [7, 10, 13]), vf: (k, h) => 'barge' + h, bone: torsoBone, t0: 3.2 + l * .1, T: 2.2, dt: .042 });
    // ---- tendons
    const ab = y => y < 134 ? 'farm' + S : 'uarm' + S;
    addTrain({ W: [sx(209.5), 32.6], n: [s, 0], yg: .2, R: 44, g0: 130, K: 6, yTop: 152, bone: () => 'shin' + S, t0: 4.0, T: 1.7 });
    addTrain({ W: [sx(211.3), -30.6], n: [0, -1], yg: .2, R: 44, g0: 60, K: 6, yTop: 152, bone: () => 'shin' + S, t0: 4.15, T: 1.6 });
    addTrain({ W: [sx(80.6), -45.8], n: [0, -1], yg: .2, R: 44, g0: 60, K: 8, yTop: 152, bone: () => 'thigh' + S, t0: 4.25, T: 1.6 });
    addTrain({ W: [sx(ARM_X + 26), ARM_Z + 24.2], n: [0, 1], yg: .2, R: 44, g0: 112, K: 10, skip: [5, 30], yTop: 224, bone: ab, t0: 4.7, T: 1.8 });
    addTrain({ W: [sx(ARM_X - 26.1), ARM_Z + 24.2], n: [0, 1], yg: .2, R: 44, g0: 112, K: 10, skip: [5, 30], yTop: 224, bone: ab, t0: 4.9, T: 1.8 });
    addTrain({ W: [sx(ARM_X + 24.2), ARM_Z - 26.1], n: [s, 0], yg: 14.5, R: 44, g0: 150, K: 12, yTop: 216, bone: ab, t0: 4.6, T: 1.9 });
    addTrain({ W: [sx(78.9), 45.8], n: [0, 1], yg: .2, R: 44, g0: 60, K: 14, yTop: 242, bone: torsoBone, t0: 4.35, T: 1.9 });
  }
  for (let l = 0; l < 6; l++) addLane({ W: [(l - 2.5) * 11.9, 47.6], n: [0, 1], yg: 0, R: 24, g0: 172, pitch: 20, K: 9, yTop: 121, dy: 12.4, w: 11.4, L: 11.2, hf: k => [7, 9, 11, 13].reduce((p, c) => { const x = 6.5 + 4.5 * Math.abs(Math.sin((k + .5) * PI / 3)) * (1 - Math.abs(l - 2.5) * .08); return Math.abs(c - x) < Math.abs(p - x) ? c : p; }), vf: (k, h) => 'house' + h + (l + k) % 3, bone: torsoBone, t0: 4.35 + Math.abs(l - 2.5) * .06, T: 1.75, dt: .05 });
  for (const s of [1, -1]) for (let l = 0; l < 3; l++) addLane({ W: [s * (44 + l * 12.2), 47.6], n: [0, 1], yg: 0, R: 24, g0: 172, pitch: 20, K: 3, yTop: 48, dy: 12.4, w: 11.4, L: 11.2, hf: k => [13, 11, 9][(k + l) % 3], vf: (k, h) => 'house' + h + (l + k) % 3, bone: () => 'pelvis', t0: 4.7 + l * .07, T: 1.5, dt: .06 });
  // ---- torso leaves and locks
  for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) {
    if (i < 2) addLeaf(cT, i, j, 0, 27, 7.6, 'pelvis', 14); if (i > -2) addLeaf(cT, i, j, 2, 27, 7.6, 'pelvis', 14);
    if (j < 1) addLeaf(cT, i, j, 1, 27, 7.6, 'pelvis', 14); if (j > -1) addLeaf(cT, i, j, 3, 27, 7.6, 'pelvis', 14);
  }
  for (const i of [-2, 2]) { addLeaf(cT, i, 1, 1, 27.4, 12, 'chest', 14, 206, [3.3, 4.3], 'leafB'); addLeaf(cT, i, -1, 3, 27.4, 6, 'pelvis', 14, 2, null); }
  for (let L = 1; L < 18; L++) for (let i = -2; i < 2; i++) for (const j of [1, -1]) { if (L >= 3 && L < 9 && (i === -2 || i === 1)) continue; addLock(cT, j > 0 ? i : i + 1, j, j > 0 ? 1 : 3, 1, LV * (L + .5), 14, torsoBone(LV * L + 7), sl[(j > 0 ? i : i + 1) + ',' + j + ',' + L], TT.lock + L * .03); }
  // ---- stadium: tilts up on its seaward edge, slides to the torso, rises to the chest. Petals open later (chest reactor)
  const SZ = 141, SR = 52, NW = 28, zf = SZ + SR;
  const stadT = t => { const a = E01(t, TT.stadTilt[0], TT.stadTilt[1]) * PI / 2, sld = E01(t, TT.stadSlide[0], TT.stadSlide[1]), up = E01(t, TT.stadUp[0], TT.stadUp[1]); const T = xabout([0, 0, zf], qx(a)); return { p: [T.p[0], T.p[1] + up * 137, T.p[2] - sld * (zf - 48.2)], q: T.q }; };
  STADT = stadT; const addStad = (v, dim, loc, kind, hull, petal) => addPiece({ kind: kind || 'stadium', v, bone: 'chest', dim, asm: xmul(stadT(99), loc), path: t => xmul(stadT(t), loc), end: 4.5, hull, petal });
  for (let k = 0; k < NW; k++) { const a = (k + .5) / NW * TAU, q = qy(a), dir = [Math.sin(a), 0, Math.cos(a)];
    const wedge = (r0, r1, h) => { const t = Math.tan(PI / NW) - .004; return [[-r0 * t, r0], [r0 * t, r0], [r1 * t, r1], [-r1 * t, r1]].flatMap(([x, z]) => [[x, -h / 2, z - (r0 + r1) / 2], [x, h / 2, z - (r0 + r1) / 2]]); };
    addStad('standLow', [2 * 46 * Math.tan(PI / NW), 12, 17], { p: [dir[0] * 34, 6.2, dir[2] * 34 + SZ], q }, 'stadium', wedge(25.5, 42.5, 12));
    addStad('standUp', [2 * 52 * Math.tan(PI / NW), 18, 9], { p: [dir[0] * 47.2, 9.2, dir[2] * 47.2 + SZ], q }, 'stadium', wedge(42.7, 51.7, 18));
    addStad('petal', [2 * 52 * Math.tan(PI / NW), 1.6, 23], { p: [dir[0] * 40.2, 19.4, dir[2] * 40.2 + SZ], q }, 'petal', wedge(28.7, 51.7, 1.6), { a, k });
  }
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) addStad('pitch', [11.6, 1.4, 11.6], { p: [i * 12, .8, SZ + j * 12], q: QI }, 'pitch', null, { pitch: [i, j] });
  for (let k = 0; k < 8; k++) { const a = (k + .5) / 8 * TAU; addStad('reactor', [5.9, 7, 4], { p: [Math.sin(a) * 9.5, 12, SZ + Math.cos(a) * 9.5], q: qy(a) }, 'reactor'); }
  // ---- bridge: two bascule leaves fold up into the spine
  const BZ = -110, BY = 25, SEG = 13.5, NS = 16;
  for (const s of [1, -1]) for (let k = 0; k < NS; k++) for (const half of [-1, 1]) {
    const path = t => { let x = 8 * s, y = BY, ang = 0; for (let m = 0; m <= k; m++) { const t0 = 2.9 + m * .055; ang = E01(t, t0, t0 + 1.75) * PI / 2; if (m < k) { x += s * Math.cos(ang) * SEG; y += Math.sin(ang) * SEG; } }
      const d = [s * Math.cos(ang), Math.sin(ang)], n = [-s * Math.sin(ang), Math.cos(ang)]; const sl2 = E01(t, 5.15, 5.85); const sp = (k % 2) ? -2.2 * E01(t, 5.9, 6.2) : 0;
      return { p: [x + d[0] * SEG / 2 + n[0] * 3, y + d[1] * SEG / 2 + n[1] * 3, BZ + half * 5.5 + sl2 * 50.6 + sp], q: qmul(qz(s > 0 ? ang : -ang), s > 0 ? QI : qy(PI)) }; };
    addPiece({ kind: 'bridge', v: half > 0 === s > 0 ? 'deckA' : 'deckB', bone: torsoBone(BY + SEG * (k + .5)), dim: [SEG - .3, 5.8, 10.8], asm: path(99), path, end: 6.3 });
    const tp = t => { const X = path(t); return { p: vadd(X.p, qrot(X.q, [0, 1.3, s * half * 5.95])), q: X.q }; };
    addPiece({ kind: 'truss', v: 'truss', bone: torsoBone(BY + SEG * (k + .5)), dim: [SEG - .5, 3.2, .8], asm: tp(99), path: tp, end: 6.3 });
  }
  addPiece({ kind: 'bridge', v: 'deckC', bone: 'pelvis', dim: [15.6, 5.8, 21.6], asm: { p: [0, 11, BZ + 50.6], q: QI }, end: 3.7, path: t => ({ p: [0, BY + 3 - 17 * E01(t, 2.6, 2.95), BZ + 50.6 * E01(t, 2.2, 2.6)], q: QI }) });
  for (const s of [1, -1]) for (const m of [0, 1]) for (let k = 0; k < 4; k++) { const z0 = m ? BZ - 16.5 : BZ + 16.5, z1 = m ? -62.4 : -53.4, y = 12 + k * 24; // masts: become the back fins
    addPiece({ kind: 'mast', v: k === 3 ? 'mastTop' : 'mast', bone: 'chest', dim: [8, 23.8, 8], asm: { p: [s * 15.2, y + 160, z1], q: QI }, end: 6.4, path: t => { const a = E01(t, 5.78, 6.24), b = E01(t, 6.2, 6.4), c = E01(t, 6.38, 6.85); return { p: [s * lerp(222.5, 15.2, a), y + 160 * c, lerp(z0, z1, b)], q: QI }; } }); }
  // ---- head: the crowns of the nine central towers
  const onT = (i, j, dim, y, v, bone, fin, seq) => { // sits on tower (i,j); fin = final bind position; seq = [[axis, t0, t1], ...] legs of the slide
    const p0 = [i * PA, y, j * PA]; return addPiece({ kind: 'head', v, bone, dim, asm: { p: fin, q: QI }, end: 5.5, path: t => { const c = cT.at(i, j, t), p = [c[0], y, c[1]]; for (const [ax, a, b] of seq) p[ax] += (fin[ax] - p0[ax]) * E01(t, a, b); return { p, q: QI }; } }); };
  for (let k = 0; k < 4; k++) onT(0, 0, [27.6, 12.9, 27.6], 252 + 6.5 + k * 13, k === 2 ? 'skullEye' : 'skull', 'head', [0, 258.5 + k * 13, 0], []);
  onT(0, 0, [23, 10, 23], 304 + 5.1, 'observatory', 'head', [0, 309.1, 0], []);
  onT(0, 1, [28, 22, 14], 252 + 11.1, 'jaw', 'head', [0, 265.1, 21.2], [[2, 3.0, 3.6]]);
  onT(0, 1, [38, 11, 15], 274.4 + 5.6, 'brow', 'head', [0, 298.5, 21.8], [[1, 3.7, 4.1], [2, 4.1, 4.5]]);
  for (const s of [1, -1]) {
    onT(s, 0, [11, 41, 28], 252 + 20.6, 'cheek', 'head', [s * 19.8, 272.6, -1], [[0, 3.2, 3.8], [2, 3.8, 4.0]]);
    onT(s, -1, [12, 27, 22], 252 + 13.6, 'pod', 'head', [s * 31.8, 290, -2], [[1, 3.6, 4.15], [0, 4.15, 4.35], [2, 4.35, 4.95]]);
    onT(s, 1, [4, 58, 12], 252 + 29.1, 'fin', 'head', [s * 40.2, 311, 2], [[0, 3.8, 4.3], [1, 4.3, 4.8], [2, 4.8, 5.2]]);
    onT(s * 2, 0, [25, 9, 26], 252 + 4.6, 'collar', 'chest', [s * 2 * PA, 256.6, 0], []); onT(s * 2, 1, [25, 12, 22], 252 + 6.1, 'collar', 'chest', [s * 2 * PA, 258.1, PA], []); onT(s * 2, -1, [25, 14, 22], 252 + 7.1, 'collar', 'chest', [s * 2 * PA, 259.1, -PA], []);
  }
  onT(0, -1, [6, 62, 22], 252 + 31.1, 'crest', 'head', [0, 303, -25.4], [[2, 3.4, 4.0], [1, 4.0, 4.6]]);
  // convex hulls for the interpenetration check (box unless the part is a wedge or a drum)
  for (const p of PIECES) { const [x, y, z] = p.dim.map(d => d / 2);
    if (p.v === 'knuckle') { const H = [], ax = [[0, 0, 1]], ed = [[0, 0, 1]]; for (let k = 0; k < 12; k++) { const a = (k + .5) / 12 * TAU; for (const s of [-1, 1]) H.push([Math.cos(a) * x, Math.sin(a) * x, s * z]); if (k < 6) { ax.push([Math.cos(k / 12 * TAU), Math.sin(k / 12 * TAU), 0]); ed.push([-Math.sin(k / 12 * TAU), Math.cos(k / 12 * TAU), 0]); } } p.H = H; p.ax = ax; p.ed = ed; }
    else if (p.hull) { p.H = p.hull; p.ax = [[0, 1, 0]]; p.ed = [[0, 1, 0]]; for (const [a, b] of [[0, 2], [2, 4], [4, 6], [6, 0]]) { const d = vnorm(vsub(p.hull[b], p.hull[a])); p.ed.push(d); p.ax.push(vcross(d, [0, 1, 0])); } }
    else { p.H = []; for (const a of [-x, x]) for (const b of [-y, y]) for (const c of [-z, z]) p.H.push([a, b, c]); p.ax = p.ed = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; } }
  for (const p of PIECES) { p.city = p.path(0); p.bi = BI[p.bone]; p.r = Math.hypot(...p.dim) / 2; p.asm = p.path(99); }
  return PIECES;
}
// pose of a piece in bind space at transformation time tau
const pieceBind = (p, tau) => tau >= p.end + .6 ? p.asm : p.path(tau);
