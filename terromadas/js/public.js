import { CONFIG } from './config.js';
import { store } from './store.js';
import { h, $, fmtPrice, waLink, safeImg, toast } from './dom.js';

let settings = CONFIG.defaults;
let packages = [];
let lastFocus = null;
const filters = { q: '', dest: '', cat: '' };
const trip = { date: '', pax: '2' };

const waNumber = () => settings.whatsapp;
const byNewest = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);

// Íconos estáticos (no vienen de la base de datos)
const CAT_ICONS = {
  Playa: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  'Montaña': '<path d="M3 20l6-11 4 6 3-4 5 9z"/>',
  Aventura: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  Cultura: '<path d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M3 10l9-6 9 6z"/>',
  Romance: '<path d="M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11z"/>',
  Familia: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.5 3-6 6-6s6 2.5 6 6M15 14.5c3 0 6 2 6 5.5"/>'
};
const icon = name => {
  const s = document.createElement('span');
  s.innerHTML = `<svg class="i" viewBox="0 0 24 24">${CAT_ICONS[name] || CAT_ICONS.Aventura}</svg>`;
  return s.firstChild;
};

function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

function consultText(p, date) {
  const parts = [`Hola Terromadas! Me interesa el paquete "${p.title}"`];
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

function card(p, isOffer) {
  const sold = p.status === 'soldout';
  const img = safeImg(p.thumb);
  return h('article', { class: 'pcard' },
    h('button', { class: 'pimg', onclick: () => openModal(p.id), 'aria-label': `Ver detalle de ${p.title}` },
      img ? h('img', { src: img, alt: '', loading: 'lazy' }) : null,
      sold ? h('span', { class: 'tag sold' }, 'AGOTADO') : (isOffer || p.offer) && p.status === 'active' ? h('span', { class: 'tag' }, 'OFERTA') : null),
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

function render() {
  const visible = packages.filter(p => p.status !== 'paused').sort(byNewest);
  const offers = visible.filter(p => p.offer && p.status === 'active')
    .sort((a, b) => (a.offerOrder || 0) - (b.offerOrder || 0)).slice(0, CONFIG.maxOffers);

  const oc = $('#offerCards'); oc.replaceChildren();
  if (offers.length) offers.forEach(p => oc.append(card(p, true)));
  else oc.append(h('div', { class: 'empty', style: 'grid-column:1/-1' }, 'Pronto vas a ver acá nuestras próximas ofertas. ¡Seguinos en Instagram!'));

  const q = filters.q.trim().toLowerCase();
  const list = visible.filter(p => (!filters.dest || p.destination === filters.dest)
    && (!filters.cat || p.category === filters.cat)
    && (!q || `${p.title} ${p.destination}`.toLowerCase().includes(q)));
  const pc = $('#pkgCards'); pc.replaceChildren();
  if (list.length) list.forEach(p => pc.append(card(p)));
  else pc.append(h('div', { class: 'empty', style: 'grid-column:1/-1' }, visible.length ? 'No encontramos paquetes con ese filtro.' : 'Estamos cargando nuevos paquetes. Escribinos por WhatsApp y te asesoramos.'));

  const cats = $('#cats'); cats.replaceChildren();
  const used = new Set(visible.map(p => p.category));
  CONFIG.categories.filter(c => used.has(c)).forEach(c => cats.append(
    h('button', { class: 'cat', type: 'button', 'aria-pressed': filters.cat === c ? 'true' : 'false',
      onclick: () => { filters.cat = filters.cat === c ? '' : c; render(); } }, icon(c), c)));
}

function fillDestinations() {
  const dests = [...new Set(packages.filter(p => p.status !== 'paused').map(p => p.destination).filter(Boolean))].sort();
  for (const sel of [$('#dest'), $('#sDest')]) {
    const first = sel.id === 'dest' ? 'Todos los destinos' : 'Cualquier destino';
    sel.replaceChildren(h('option', { value: '' }, first), ...dests.map(x => h('option', { value: x }, x)));
    sel.value = dests.includes(filters.dest) ? filters.dest : '';
  }
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
  $('#aboutText').textContent = s.about;
  const hi = safeImg(s.heroImage);
  if (hi) { const im = $('#heroImg'); im.src = hi; im.hidden = false; $('#heroArt').hidden = true; }
  const arma = s.armaUrl && /^https?:\/\//i.test(s.armaUrl) ? s.armaUrl : waLink(s.whatsapp, 'Hola Terromadas! Quiero armar mi viaje a medida.');
  ['#navArma', '#bandArma'].forEach(i => $(i).href = arma);
  const wa = waLink(s.whatsapp, 'Hola Terromadas! Quiero hacer una consulta.');
  ['#fab', '#footWa', '#footWaIc'].forEach(i => $(i).href = wa);
  if (handle(s.instagram)) social('#footIg', 'https://instagram.com/' + handle(s.instagram));
  if (handle(s.facebook)) social('#footFb', 'https://facebook.com/' + handle(s.facebook));
  if (handle(s.tiktok)) social('#footTk', 'https://tiktok.com/@' + handle(s.tiktok));
  if (s.email) { const m = $('#footMail'); m.href = 'mailto:' + s.email; m.textContent = s.email; m.hidden = false; }
  if (s.city) $('#footCity').textContent = 'Viajes y turismo · ' + s.city;
}

async function init() {
  $('#year').textContent = new Date().getFullYear();
  const burger = $('#burger'), menu = $('#menu');
  burger.addEventListener('click', () => { const o = menu.classList.toggle('open'); burger.setAttribute('aria-expanded', o); });
  menu.addEventListener('click', e => { if (e.target.closest('a')) { menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); } });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal').classList.contains('open')) closeModal(); });

  $('#q').addEventListener('input', e => { filters.q = e.target.value; render(); });
  $('#dest').addEventListener('change', e => { filters.dest = e.target.value; $('#sDest').value = filters.dest; render(); });
  $('#sDest').addEventListener('change', e => { filters.dest = e.target.value; $('#dest').value = filters.dest; render(); });
  $('#sDate').addEventListener('change', e => { trip.date = e.target.value; render(); });
  $('#sPax').addEventListener('change', e => { trip.pax = e.target.value; render(); });
  $('#search').addEventListener('submit', e => e.preventDefault());
  $('#sGo').addEventListener('click', () => {
    filters.dest = $('#sDest').value; $('#dest').value = filters.dest; render();
    $('#paquetes').scrollIntoView({ behavior: 'smooth' });
  });

  try {
    [settings, packages] = await Promise.all([store.getSettings(), store.listPackages()]);
  } catch (e) {
    console.error(e);
    toast('No pudimos cargar los paquetes. Probá recargar la página.', 'err');
  }
  applySettings();
  fillDestinations();
  render();
  const m = location.hash.match(/^#paquete=(.+)$/);
  if (m) openModal(decodeURIComponent(m[1]));
}
init();
