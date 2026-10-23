import { CONFIG } from './config.js';
import { store } from './store.js';
import { h, $, fmtPrice, waLink, safeImg, toast } from './dom.js';

let settings = CONFIG.defaults;
let packages = [];
let external = [];
let lastFocus = null;
const trip = { date: '', pax: '2' };

const waNumber = () => settings.whatsapp;

function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

function consultText(p, date) {
  const parts = [`Hola Terromadas! Me interesa "${p.title}"`];
  if (p.destination) parts.push(`a ${p.destination}`);
  if (p.duration) parts.push(`(${p.duration})`);
  let t = parts.join(' ');
  if (date) t += `. Fecha de salida: ${date}`;
  else if (trip.date) t += `. Fecha deseada: ${fmtDate(trip.date)}`;
  if (trip.pax) t += `. Pasajeros: ${trip.pax}`;
  return t + '. ¿Me pasan más información?';
}

function priceBlock(p) {
  return h('div', { class: 'price' },
    h('small', {}, p.price ? `Desde${p.priceNote ? ' · ' + p.priceNote : ''}` : ''),
    h('b', {}, fmtPrice(p.price, p.currency)),
    p.oldPrice ? h('s', {}, fmtPrice(p.oldPrice, p.currency)) : null);
}

/* ---------- vidriera (paquetes propios, máx. 5) ---------- */
function card(p) {
  const sold = p.status === 'soldout';
  const img = safeImg(p.thumb);
  return h('article', { class: 'pcard' },
    h('button', { class: 'pimg', onclick: () => openModal(p.id), 'aria-label': `Ver detalle de ${p.title}` },
      img ? h('img', { src: img, alt: '', loading: 'lazy' }) : null,
      sold ? h('span', { class: 'tag sold' }, 'AGOTADO') : p.oldPrice ? h('span', { class: 'tag' }, 'PROMO') : null),
    h('div', { class: 'pbody' },
      h('div', { class: 'dest' }, p.destination || ''),
      h('h3', {}, p.title),
      h('div', { class: 'meta' }, p.duration ? h('span', {}, '🗓 ' + p.duration) : null, p.dates?.[0] ? h('span', {}, 'Salida: ' + p.dates[0].split(' al ')[0]) : null),
      priceBlock(p)),
    h('div', { class: 'pact' },
      h('button', { class: 'btn btn-line', style: 'color:var(--wine)', onclick: () => openModal(p.id) }, 'Ver detalle'),
      sold
        ? h('span', { class: 'btn btn-wa', 'aria-disabled': 'true' }, 'Agotado')
        : h('a', { class: 'btn btn-wa', href: waLink(waNumber(), consultText(p)), target: '_blank', rel: 'noopener noreferrer' }, 'Consultar')));
}

/* ---------- más opciones (proveedor, máx. 5, redirige) ---------- */
function extUrl(u) {
  try {
    const x = new URL(u);
    const host = x.hostname.replace(/^www\./, '');
    return x.protocol === 'https:' && (host === CONFIG.externalHost || host.endsWith('.' + CONFIG.externalHost)) ? x.href : '';
  } catch { return ''; }
}

function extCard(x) {
  const url = extUrl(x.url);
  const img = safeImg(x.image);
  return h('article', { class: 'pcard' },
    h('a', { class: 'pimg', href: url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Ver ${x.title} en ${CONFIG.externalHost}` },
      img ? h('img', { src: img, alt: '', loading: 'lazy' }) : null),
    h('div', { class: 'pbody' },
      h('div', { class: 'dest' }, 'Terromadas Viajes'),
      h('h3', {}, x.title),
      x.subtitle ? h('div', { class: 'meta' }, h('span', {}, x.subtitle)) : null,
      x.price ? h('div', { class: 'price' }, h('b', { style: 'font-size:20px' }, x.price)) : null),
    h('div', { class: 'pact' },
      h('a', { class: 'btn btn-red', href: url, target: '_blank', rel: 'noopener noreferrer' }, 'Ver detalle y reservar')));
}

function render() {
  const vid = packages.filter(p => p.offer && p.status !== 'paused')
    .sort((a, b) => (a.offerOrder || 0) - (b.offerOrder || 0)).slice(0, CONFIG.maxOffers);
  const vc = $('#vidCards'); vc.replaceChildren();
  if (vid.length) vid.forEach(p => vc.append(card(p)));
  else vc.append(h('div', { class: 'empty', style: 'grid-column:1/-1' }, 'Estamos actualizando nuestra vidriera. Escribinos por WhatsApp y te asesoramos.'));

  const ext = external.filter(x => extUrl(x.url)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, CONFIG.maxExternal);
  const ec = $('#extCards'); ec.replaceChildren(...ext.map(extCard));
  $('#mas').hidden = !ext.length;
  $('#navMas').hidden = !ext.length;
}

async function openModal(id) {
  const p = packages.find(x => x.id === id);
  if (!p) return;
  lastFocus = document.activeElement;
  history.replaceState(null, '', '#paquete=' + id);
  const sheet = $('#sheet');
  const sold = p.status === 'soldout';
  let date = p.dates?.[0] || '';
  const main = h('img', { class: 'main', alt: p.title, src: safeImg(p.thumb) });
  const thumbs = h('div', { class: 'thumbs' });
  const gal = h('div', { class: 'gal' }, main, thumbs);

  const wa = h('a', { class: 'btn btn-wa', target: '_blank', rel: 'noopener noreferrer' }, 'Consultar por WhatsApp');
  const setWa = () => { wa.href = waLink(waNumber(), consultText(p, date)); };
  setWa();
  const dateSel = p.dates?.length ? h('div', {}, h('label', { for: 'dsel' }, 'Elegí fecha de salida'),
    h('select', { id: 'dsel', onchange: e => { date = e.target.value; setWa(); } }, p.dates.map(x => h('option', { value: x }, x)))) : null;

  sheet.replaceChildren(
    h('button', { class: 'close', onclick: closeModal, 'aria-label': 'Cerrar' }, '×'),
    gal,
    h('div', { class: 'det' },
      h('div', {},
        h('div', { class: 'dest' }, [p.destination, p.category].filter(Boolean).join(' · ')),
        h('h2', { id: 'mTitle' }, p.title),
        h('div', { class: 'meta' }, p.duration ? h('span', {}, '🗓 ' + p.duration) : null),
        p.description ? h('p', { style: 'margin-top:14px;color:#5c4744' }, p.description) : null,
        p.includes?.length ? [h('h4', {}, 'Qué incluye'), h('ul', {}, p.includes.map(i => h('li', {}, i)))] : null,
        p.dates?.length ? [h('h4', {}, 'Fechas de salida'), h('ul', {}, p.dates.map(i => h('li', {}, i)))] : null),
      h('div', { class: 'buy' }, priceBlock(p), sold ? h('div', { class: 'tag sold', style: 'position:static;text-align:center' }, 'AGOTADO') : [dateSel, wa],
        h('p', { style: 'font-size:12px;color:var(--muted)' }, 'Precio y disponibilidad sujetos a confirmación.'))));
  $('#modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  $('.close', sheet).focus();

  try {
    const photos = (await store.getPhotos(id)).map(safeImg).filter(Boolean);
    if (photos.length) {
      main.src = photos[0];
      if (photos.length > 1) photos.forEach((src, i) => thumbs.append(
        h('button', { 'aria-label': `Foto ${i + 1}`, 'aria-current': i === 0 ? 'true' : 'false', onclick: e => {
          main.src = src; [...thumbs.children].forEach(b => b.setAttribute('aria-current', 'false')); e.currentTarget.setAttribute('aria-current', 'true');
        } }, h('img', { src, alt: '' }))));
      else thumbs.remove();
    } else thumbs.remove();
  } catch { thumbs.remove(); }
}

function closeModal() {
  $('#modal').classList.remove('open');
  document.body.style.overflow = '';
  history.replaceState(null, '', location.pathname + location.search);
  lastFocus?.focus?.();
}

const social = (id, url) => { const a = $(id); if (url) { a.href = url; a.hidden = false; } };
const handle = v => String(v || '').trim().replace(/^@/, '').replace(/^https?:\/\/[^/]+\//, '').replace(/[^\w.\-/]/g, '');

function applySettings() {
  const s = settings;
  $('#heroTitle').textContent = s.heroTitle;
  $('#heroTitle2').textContent = s.heroTitle2;
  $('#heroScript').textContent = s.heroScript;
  $('#heroText').textContent = s.heroText;
  const at = $('#aboutText'); at.replaceChildren(...String(s.about || '').split(/\n\s*\n/).filter(Boolean).map(t => h('p', {}, t.trim())));
  $('#ownerName').textContent = s.owner || '';
  $('#ownerRole').textContent = s.ownerRole || '';
  const ai = safeImg(s.aboutImage);
  if (ai) { const im = $('#aboutImg'); im.src = ai; im.hidden = false; $('#aboutArt').hidden = true; }
  $('#footAddr').textContent = s.address || ''; $('#footHours').textContent = s.hours || ''; $('#footLegajo').textContent = s.legajo || '';
  const hi = safeImg(s.heroImage);
  if (hi) { const im = $('#heroImg'); im.src = hi; im.hidden = false; $('#heroArt').hidden = true; }
  const arma = s.armaUrl && /^https?:\/\//i.test(s.armaUrl) ? s.armaUrl : waLink(s.whatsapp, 'Hola Terromadas! Quiero armar mi viaje a medida.');
  ['#navArma', '#heroArma', '#bandArma'].forEach(i => $(i).href = arma);
  const wa = waLink(s.whatsapp, 'Hola Terromadas! Quiero hacer una consulta.');
  ['#fab', '#footWa', '#footWaIc'].forEach(i => $(i).href = wa);
  if (handle(s.instagram)) social('#footIg', 'https://instagram.com/' + handle(s.instagram));
  if (handle(s.facebook)) social('#footFb', 'https://facebook.com/' + handle(s.facebook));
  if (handle(s.tiktok)) social('#footTk', 'https://tiktok.com/@' + handle(s.tiktok));
  if (s.email) { const m = $('#footMail'); m.href = 'mailto:' + s.email; m.textContent = s.email; m.hidden = false; }
}

async function init() {
  $('#year').textContent = new Date().getFullYear();
  const burger = $('#burger'), menu = $('#menu');
  burger.addEventListener('click', () => { const o = menu.classList.toggle('open'); burger.setAttribute('aria-expanded', o); });
  menu.addEventListener('click', e => { if (e.target.closest('a')) { menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); } });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal').classList.contains('open')) closeModal(); });

  // Cotización rápida: arma el mensaje de WhatsApp con destino, fecha y pasajeros
  $('#sDate').addEventListener('change', e => { trip.date = e.target.value; render(); });
  $('#sPax').addEventListener('change', e => { trip.pax = e.target.value; render(); });
  $('#search').addEventListener('submit', e => e.preventDefault());
  $('#sGo').addEventListener('click', () => {
    const dest = $('#sDest').value.trim();
    let t = dest ? `Hola Terromadas! Quiero cotizar un viaje a ${dest}` : 'Hola Terromadas! Quiero cotizar un viaje';
    if (trip.date) t += `. Fecha deseada: ${fmtDate(trip.date)}`;
    t += `. Pasajeros: ${trip.pax}.`;
    window.open(waLink(waNumber(), t), '_blank', 'noopener');
  });

  try {
    [settings, packages, external] = await Promise.all([store.getSettings(), store.listPackages(), store.listExternal().catch(() => [])]);
  } catch (e) {
    console.error(e);
    toast('No pudimos cargar los paquetes. Probá recargar la página.', 'err');
  }
  applySettings();
  render();
  const m = location.hash.match(/^#paquete=(.+)$/);
  if (m) openModal(decodeURIComponent(m[1]));
}
init();
