// Piezas compartidas entre el inicio y las páginas de cada destino.
import { CONFIG } from './config.js';
import { store, isDemo } from './store.js';
import { h, $, fmtPrice, waLink, safeImg, toast } from './dom.js';

export const state = { settings: CONFIG.defaults, packages: [] };
export const trip = { date: '', pax: '2' };
let lastFocus = null;

export const waNumber = () => state.settings.whatsapp;
export const catOf = c => (CONFIG.categories.includes(c) ? c : '');
export const FEATURED = 'Destacados';
// Sin ".html": con URLs limpias el servidor redirige destino.html y perdería el ?tipo=
export const destinoUrl = cat => 'destino?tipo=' + encodeURIComponent(cat);

// Paquetes visibles de un destino: primero las promos, después los más nuevos; tope por destino
export const visible = cat => state.packages
  .filter(p => p.status !== 'paused' && catOf(p.category) === cat)
  .sort((a, b) => (b.oldPrice ? 1 : 0) - (a.oldPrice ? 1 : 0) || (b.createdAt || 0) - (a.createdAt || 0))
  .slice(0, CONFIG.maxPerCategory);

// Destacados: los que Flavia marca con la estrella (hasta 8), de cualquier destino
export const featured = () => state.packages
  .filter(p => p.featured && p.status !== 'paused')
  .sort((a, b) => (b.oldPrice ? 1 : 0) - (a.oldPrice ? 1 : 0) || (b.createdAt || 0) - (a.createdAt || 0))
  .slice(0, CONFIG.maxFeatured);

// Copia local del catálogo (15 minutos): al volver al inicio o entrar a un destino se ve al instante,
// y mientras tanto se pide la versión nueva. En modo demo no se usa.
const CACHE_KEY = 'terromadas-catalog-v1', CACHE_MS = 15 * 60 * 1000;

export function loadFromCache() {
  if (isDemo) return false;
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (c && c.packages && Date.now() - c.t < CACHE_MS) { state.settings = c.settings; state.packages = c.packages; return true; }
  } catch { /* sin copia */ }
  return false;
}

function saveCache() {
  if (isDemo) return;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), settings: state.settings, packages: state.packages })); }
  catch { try { localStorage.removeItem(CACHE_KEY); } catch { /* nada */ } }
}

// Devuelve true si lo que llegó es distinto de lo que ya se estaba mostrando
export async function loadCatalog() {
  const prev = JSON.stringify([state.settings, state.packages]);
  try { [state.settings, state.packages] = await Promise.all([store.getSettings(), store.listPackages()]); }
  catch (e) { console.error(e); toast('No pudimos cargar los paquetes. Probá recargar la página.', 'err'); return false; }
  saveCache();
  return JSON.stringify([state.settings, state.packages]) !== prev;
}

export function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export function consultText(p, date) {
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

export function card(p, showCat = false) {
  const sold = p.status === 'soldout';
  const img = safeImg(p.thumb);
  return h('article', { class: 'pcard reveal' },
    h('button', { class: 'pimg', onclick: () => openModal(p.id), 'aria-label': `Ver detalle de ${p.title}` },
      img ? h('img', { src: img, alt: '', loading: 'lazy', decoding: 'async' }) : null,
      sold ? h('span', { class: 'tag sold' }, 'AGOTADO') : p.oldPrice ? h('span', { class: 'tag' }, 'PROMO') : null,
      showCat ? h('span', { class: 'tag cat' }, catOf(p.category)) : null),
    h('div', { class: 'pbody' },
      h('div', { class: 'dest' }, p.destination || ''),
      h('h3', {}, p.title),
      p.description ? h('p', { class: 'pdesc' }, p.description) : null,
      h('div', { class: 'meta' }, p.duration ? h('span', {}, '🗓 ' + p.duration) : null, p.dates?.[0] ? h('span', {}, 'Salida: ' + p.dates[0].split(' al ')[0]) : null),
      priceBlock(p)),
    h('div', { class: 'pact' },
      h('button', { class: 'btn btn-detail', onclick: () => openModal(p.id) }, 'Ver detalles'),
      sold
        ? h('span', { class: 'btn btn-wa', 'aria-disabled': 'true' }, 'Agotado')
        : h('a', { class: 'btn btn-wa', href: waLink(waNumber(), consultText(p)), target: '_blank', rel: 'noopener noreferrer' }, 'Consultar')));
}

export async function openModal(id) {
  const p = state.packages.find(x => x.id === id);
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

export function closeModal() {
  $('#modal').classList.remove('open');
  document.body.style.overflow = '';
  history.replaceState(null, '', location.pathname + location.search);
  lastFocus?.focus?.();
}

/* ---------- menú, modal, pie de página y enlaces de WhatsApp (todas las páginas) ---------- */
const social = (id, url) => { const a = $(id); if (a && url) { a.href = url; a.hidden = false; } };
const handle = v => String(v || '').trim().replace(/^@/, '').replace(/^https?:\/\/[^/]+\//, '').replace(/[^\w.\-/]/g, '');
const setText = (id, v) => { const e = $(id); if (e) e.textContent = v || ''; };

export function initChrome() {
  setText('#year', new Date().getFullYear());
  const burger = $('#burger'), menu = $('#menu');
  burger.addEventListener('click', () => { const o = menu.classList.toggle('open'); burger.setAttribute('aria-expanded', o); });
  menu.addEventListener('click', e => { if (e.target.closest('a')) { menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); } });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal').classList.contains('open')) closeModal(); });
}

export function applyCommon() {
  const s = state.settings;
  setText('#footAddr', s.address); setText('#footHours', s.hours); setText('#footLegajo', s.legajo);
  const arma = s.armaUrl && /^https?:\/\//i.test(s.armaUrl) ? s.armaUrl : waLink(s.whatsapp, 'Hola Terromadas! Quiero armar mi viaje a medida.');
  ['#navArma', '#heroArma', '#bandArma'].forEach(i => { const e = $(i); if (e) e.href = arma; });
  const wa = waLink(s.whatsapp, 'Hola Terromadas! Quiero hacer una consulta.');
  ['#fab', '#footWa', '#footWaIc'].forEach(i => { const e = $(i); if (e) e.href = wa; });
  if (handle(s.instagram)) social('#footIg', 'https://instagram.com/' + handle(s.instagram));
  if (handle(s.facebook)) social('#footFb', 'https://facebook.com/' + handle(s.facebook));
  if (handle(s.tiktok)) social('#footTk', 'https://tiktok.com/@' + handle(s.tiktok));
  if (s.email) { const m = $('#footMail'); m.href = 'mailto:' + s.email; m.textContent = s.email; m.hidden = false; }
}

/* ---------- formulario de contacto: arma el mensaje y abre WhatsApp ---------- */
export function mountContactForm(box, preset = '') {
  const inp = (props) => h('input', props);
  const name = inp({ type: 'text', required: true, maxlength: 60, autocomplete: 'name', id: 'cfName' });
  const phone = inp({ type: 'tel', required: true, maxlength: 25, autocomplete: 'tel', id: 'cfPhone', placeholder: 'Ej: 3571 123456' });
  const dest = h('select', { id: 'cfDest' }, [h('option', { value: '' }, 'Todavía no lo sé'), ...CONFIG.categories.map(c => h('option', { value: c, selected: c === preset }, c))]);
  const msg = h('textarea', { id: 'cfMsg', maxlength: 600, placeholder: 'Contanos qué viaje tenés en mente, fechas, cantidad de pasajeros…' });
  const f = (label, el, id) => h('div', { class: 'fld' }, h('label', { for: id }, label), el);
  box.replaceChildren(h('form', { class: 'cform', onsubmit: e => {
    e.preventDefault();
    if (String(phone.value).replace(/\D/g, '').length < 8) return toast('Revisá tu teléfono', 'err');
    let t = `Hola Terromadas! Soy ${name.value.trim()}, mi teléfono es ${phone.value.trim()}.`;
    if (dest.value) t += ` Me interesa viajar a: ${dest.value}.`;
    if (msg.value.trim()) t += ` ${msg.value.trim()}`;
    window.open(waLink(waNumber(), t), '_blank', 'noopener');
    toast('Se abrió WhatsApp con tu consulta lista para enviar ✔');
  } },
    h('div', { class: 'cf-grid' }, f('Tu nombre', name, 'cfName'), f('Tu teléfono', phone, 'cfPhone')),
    f('¿A dónde te gustaría viajar?', dest, 'cfDest'),
    f('Tu consulta (opcional)', msg, 'cfMsg'),
    h('button', { class: 'btn btn-red', type: 'submit' }, 'Enviar consulta por WhatsApp'),
    h('small', { class: 'cf-note' }, 'Al enviar se abre WhatsApp con tu mensaje listo. Te respondemos a la brevedad.')));
}
