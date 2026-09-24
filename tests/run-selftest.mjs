// Ejecuta las pruebas integradas de la Academia (index.html?selftest=1)
// en Chrome/Edge sin interfaz y muestra el resultado.
//   node tests/run-selftest.mjs
// Variables opcionales: CHROME=<ruta al ejecutable>
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const candidates = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);
const bin = candidates.find(p => existsSync(p));
if (!bin) { console.error('No se encontró Chrome/Edge. Define CHROME=<ruta>.'); process.exit(2); }

const page = pathToFileURL(resolve(import.meta.dirname, '..', 'index.html')).href + '?selftest=1';
const profile = mkdtempSync(join(tmpdir(), 'academia-selftest-'));
const html = execFileSync(bin, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${profile}`, '--window-size=1400,1000', '--virtual-time-budget=60000',
  '--dump-dom', page
], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180000 });

const m = html.match(/<pre id="selftest-json" hidden="">([\s\S]*?)<\/pre>/);
if (!m) { console.error('La página no produjo resultados de prueba.'); process.exit(1); }
const unesc = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const res = JSON.parse(unesc(m[1]));
for (const r of res.results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${!r.ok && r.info ? '\n    ' + r.info : ''}`);

/* maquetación: desbordamiento horizontal y hero de la portada en 7 anchos (tests/layout-check.html) */
const lay = execFileSync(bin, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--allow-file-access-from-files',
  `--user-data-dir=${profile}`, '--window-size=2000,1000', '--virtual-time-budget=120000',
  '--dump-dom', pathToFileURL(resolve(import.meta.dirname, 'layout-check.html')).href
], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
const lm = lay.match(/<pre id="layout-json" hidden="">([\s\S]*?)<\/pre>/);
const L = lm && lm[1].trim() ? JSON.parse(unesc(lm[1])) : [];
const byW = {};
L.forEach(r => { (byW[r.w] = byW[r.w] || []).push(r); });
const layTests = Object.entries(byW).sort((a, b) => b[0] - a[0]).map(([w, rs]) => {
  const bad = rs.filter(r => !r.ok), h = rs.find(r => r.p === 'inicio') || {};
  return { ok: !bad.length && rs.length === 4, name: `maquetación ${w}px: sin desbordamiento horizontal · hero con ${h.copyW}px de texto, subtítulo en ${h.ledeLines} líneas, CTA de ${h.ctaW}px`, info: bad.map(r => `${r.p}: ${JSON.stringify(r)}`).join(' | ') };
});
if (!L.length) layTests.push({ ok: false, name: 'maquetación: el arnés no devolvió resultados', info: '' });
for (const r of layTests) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${!r.ok && r.info ? '\n    ' + r.info : ''}`);
const okAll = res.ok + layTests.filter(r => r.ok).length, total = res.total + layTests.length;
console.log(`\n${okAll} / ${total} pruebas correctas`);
process.exit(okAll === total ? 0 : 1);
