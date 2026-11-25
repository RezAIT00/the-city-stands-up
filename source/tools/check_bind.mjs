// offline piece-rule check of the assembly phase (bind space). node tools/check_bind.mjs [t0 t1 dt]
import fs from 'fs'; import vm from 'vm';
const src = ['05_math.js', '40_robot.js', '42_skeleton.js', '44_check.js'].map(f => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')).join('\n');
const ctx = vm.createContext({ console, Math, globalThis: {} });
vm.runInContext(src + '\n;globalThis.API={piecePairs,assemblePose,solveRobot,standPose,bindAnkles,BI,PIECES,buildPieces,pieceBind,qrot,xinv,xmul,ARM_Z,SH_W,JA,LANES,torsoLean,TT,qconj,qmul};', ctx);
const A = ctx.globalThis.API; A.buildPieces(); A.bindAnkles(); const P = A.PIECES;
console.log('pieces', P.length, 'large', P.filter(p => p.large).length, 'ARM_Z', A.ARM_Z.toFixed(2), 'SH_W', A.SH_W.map(x => x.toFixed(1)).join());
const kinds = {}; P.forEach(p => kinds[p.kind] = (kinds[p.kind] || 0) + 1); console.log(JSON.stringify(kinds));
const vars = {}; P.forEach(p => { const k = p.v; (vars[k] ||= { n: 0, d: new Set() }).n++; vars[k].d.add(p.dim.map(x => +x.toFixed(2)).join('x')); });
if (process.argv.includes('-v')) for (const k in vars) console.log(k, vars[k].n, [...vars[k].d].join(' | '));
const nums = process.argv.slice(2).filter(a => !isNaN(+a)).map(Number); const t0 = nums[0] ?? 0, t1 = nums[1] ?? 7, dt = nums[2] ?? .1, TOL = .15;
const L = P.filter(p => p.large); const agg = {}; let tot = 0, worst = 0;
for (let t = t0; t <= t1 + 1e-6; t += dt) {
  const M = A.solveRobot(A.assemblePose(t)); const X = L.map(p => A.xmul(M[p.bi], A.pieceBind(p, t)));
  A.piecePairs(L, X, TOL, (i, j, d) => { tot++; worst = Math.max(worst, d); const k = [L[i].kind + ':' + L[i].v + '@' + L[i].bone.replace(/[LR]/, '*'), L[j].kind + ':' + L[j].v + '@' + L[j].bone.replace(/[LR]/, '*')].sort().join('  x  '); const g = (agg[k] ||= { n: 0, d: 0, t0: t, t1: t, ex: '' }); g.n++; g.t1 = t; if (d > g.d) { g.d = d; g.ex = X[i].p.map(x => x.toFixed(0)) + ' | ' + X[j].p.map(x => x.toFixed(0)) + ' t=' + t.toFixed(2); } });
}
console.log('overlaps', tot, 'worst depth', worst.toFixed(2)); Object.entries(agg).sort((a, b) => b[1].n - a[1].n).slice(0, 40).forEach(([k, g]) => console.log(g.n, 'd=' + g.d.toFixed(2), `t ${g.t0.toFixed(2)}-${g.t1.toFixed(2)}`, k, '::', g.ex));
