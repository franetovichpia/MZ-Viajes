// Cloudflare Worker (plan gratuito, sin tarjeta).
// Lee terromadasviajes.com y devuelve en JSON las 5 salidas más nuevas.
// El sitio de Terromadas lo consulta solo, cada vez que alguien lo abre.
// Seguridad: solo lee las direcciones fijas de abajo; no acepta direcciones del usuario.

const HOST = 'https://www.terromadasviajes.com';
const AGENCY = '877351';
const SOURCES = [`${HOST}/es/moreideas?agency=${AGENCY}`, `${HOST}/`];
const MAX = 5;                 // cantidad de salidas
const FRESH_SECONDS = 3600;    // se vuelve a leer la web como máximo 1 vez por hora
const KEEP_SECONDS = 86400 * 7; // si la web falla, se sirve la última copia (hasta 7 días)

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

async function readSite() {
  const byId = new Map();
  for (const src of SOURCES) {
    try {
      const r = await fetch(src, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; TerromadasSync/1.0)', 'accept-language': 'es-AR,es;q=0.9' } });
      if (!r.ok) continue;
      for (const it of parseCards(await r.text())) if (it.title && !byId.has(it.id)) byId.set(it.id, it);
    } catch { /* se prueba con la siguiente fuente */ }
  }
  const items = [...byId.values()]
    .filter(i => i.imageUrl.startsWith('https://') && i.url.startsWith(HOST + '/'))
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, MAX);
  if (!items.length) throw new Error('sin resultados');
  return { updated: new Date().toISOString(), source: HOST, items };
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' };
const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...extra }
});

let memo = null; // copia en memoria (sirve aunque no haya caché de Cloudflare)

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'GET') return json({ error: 'Método no permitido' }, 405);

    const cache = typeof caches !== 'undefined' ? caches.default : null;
    const key = new Request(new URL('/proveedor', request.url).toString());
    let stale = null;

    if (memo && Date.now() - Date.parse(memo.updated) < FRESH_SECONDS * 1000) return json(memo, 200, { 'cache-control': 'public, max-age=300' });
    if (memo) stale = memo;

    if (cache) {
      const hit = await cache.match(key);
      if (hit) {
        const data = await hit.clone().json();
        if (Date.now() - Date.parse(data.updated) < FRESH_SECONDS * 1000) return json(data, 200, { 'cache-control': 'public, max-age=300' });
        stale = data;
      }
    }
    try {
      const data = await readSite();
      memo = data;
      if (cache) ctx.waitUntil(cache.put(key, json(data, 200, { 'cache-control': `public, max-age=${KEEP_SECONDS}` })));
      return json(data, 200, { 'cache-control': 'public, max-age=300' });
    } catch {
      if (stale) return json(stale, 200, { 'cache-control': 'public, max-age=60' });
      return json({ error: 'No se pudo leer la web del proveedor', items: [] }, 502);
    }
  }
};
