import http from 'http'; import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright-core'; import { fileURLToPath } from 'url';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.png':'image/png' };
// tiny static server on a random high port; POST handlers are pluggable (frame capture)
export function serve(onPost) {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const u = new URL(q.url, 'http://x');
      if (q.method === 'POST') {
        const ch = []; q.on('data', c => ch.push(c)); q.on('end', async () => { try { await onPost?.(u, Buffer.concat(ch)); r.writeHead(200); r.end('ok'); } catch (e) { r.writeHead(500); r.end(String(e)); } });
        return;
      }
      const f = path.join(ROOT, decodeURIComponent(u.pathname)); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(r);
    });
    const tryPort = () => { const p = 40000 + Math.floor(Math.random() * 9000); srv.once('error', tryPort); srv.listen(p, '127.0.0.1', () => res({ srv, port: p })); };
    tryPort();
  });
}
export async function launch({ width = 1920, height = 1080, extra = [], headless = true } = {}) {
  const browser = await chromium.launch({ executablePath: EDGE, headless, args: [
    '--use-angle=d3d11', '--enable-gpu', '--force_high_performance_gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--force-device-scale-factor=1', '--autoplay-policy=no-user-gesture-required', '--js-flags=--max-old-space-size=8192', ...extra] });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', m => { const t = m.text(); if (!/^\[vite|Download the/.test(t)) console.log('[' + m.type() + ']', t.slice(0, 3000)); });
  page.on('pageerror', e => console.log('[pageerror]', (e.stack || e.message).slice(0, 2500)));
  return { browser, ctx, page };
}
