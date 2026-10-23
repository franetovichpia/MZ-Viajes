// Trae las salidas más recientes de terromadasviajes.com y las guarda en data/proveedor.json
// Uso:  node scripts/sync-proveedor.mjs
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = 'https://www.terromadasviajes.com';
const AGENCY = '877351';
const SOURCES = [`${HOST}/es/moreideas?agency=${AGENCY}`, `${HOST}/`];
const MAX = 5; // cantidad de salidas a mostrar (las de número más alto son las más nuevas)
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'proveedor.json');

const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const clean = s => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function parseCards(html) {
  const items = [];
  for (const block of html.split('dev-idea-card').slice(1)) {
    const link = /href="(https:\/\/www\.terromadasviajes\.com\/es\/idea\/(\d+)\/\d+\/[^"?#]*)"/.exec(block);
    if (!link) continue;
    const title = /class="c-idea-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/.exec(block);
    const img = /data-src="(https:\/\/[^"]+)"/.exec(block);
    const nights = /(\d+)\s*Noches/i.exec(block);
    const foot = /c-idea-card__foot([\s\S]*?)(?:Ver\b|<\/a>|$)/.exec(block);
    let price = foot ? clean(foot[1]).replace(/^[^D]*?(Desde)/, '$1') : '';
    price = price.replace(/(\d),(\d{3})/g, '$1.$2').replace(/Por persona/i, 'por persona').trim();
    items.push({
      id: link[2],
      title: title ? clean(title[1]) : '',
      url: decode(link[1]),
      imageUrl: img ? decode(img[1]) : '',
      subtitle: nights ? `${nights[1]} noches` : '',
      price: /^Desde/.test(price) ? price : ''
    });
  }
  return items;
}

async function get(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; TerromadasSync/1.0)', 'accept-language': 'es-AR,es;q=0.9' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.text();
}

const byId = new Map();
for (const src of SOURCES) {
  try {
    for (const it of parseCards(await get(src))) if (it.title && !byId.has(it.id)) byId.set(it.id, it);
  } catch (e) { console.warn('Aviso:', e.message); }
}
const items = [...byId.values()]
  .filter(i => i.imageUrl.startsWith('https://') && i.url.startsWith(HOST + '/'))
  .sort((a, b) => Number(b.id) - Number(a.id))
  .slice(0, MAX);

if (!items.length) { console.error('No se encontró ninguna salida. No se modificó data/proveedor.json'); process.exit(1); }

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), source: HOST, items }, null, 2) + '\n');
console.log(`Listo: ${items.length} salidas guardadas en data/proveedor.json`);
for (const i of items) console.log(`  - ${i.title} | ${i.subtitle} | ${i.price}`);
