import fs from 'fs'; import path from 'path'; import { ROOT } from './lib.mjs';
const dir = path.join(ROOT, 'src'); const files = fs.readdirSync(dir).filter(f => /^\d\d_.*\.js$/.test(f)).sort();
let code = ''; for (const f of files) code += `\n// ======== ${f} ========\n` + fs.readFileSync(path.join(dir, f), 'utf8');
let html = fs.readFileSync(path.join(dir, 'page.html'), 'utf8'); const ui = fs.existsSync(path.join(dir, 'ui.html')) ? fs.readFileSync(path.join(dir, 'ui.html'), 'utf8') : ''; const css = fs.existsSync(path.join(dir, 'ui.css')) ? fs.readFileSync(path.join(dir, 'ui.css'), 'utf8') : '';
html = html.replace('/*CODE*/', () => code).replace('<!--UI-->', () => ui).replace('/*CSS*/', () => css); fs.writeFileSync(path.join(ROOT, 'city.html'), html);
console.log('city.html', (html.length / 1024).toFixed(0) + ' KB', files.length, 'modules');
