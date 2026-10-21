import { CONFIG } from './config.js';
import { store } from './store.js';
import { h, $, fmtPrice, waLink, safeImg, toast } from './dom.js';

let settings = CONFIG.defaults;
let packages = [];
let lastFocus = null;

const waNumber = () => settings.whatsapp;
const byNewest = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);

function consultText(p, date) {
  const parts = [`Hola Terromadas! Me interesa el paquete "${p.title}"`];
  if (p.destination) parts.push(`a ${p.destination}`);
  if (p.duration) parts.push(`(${p.duration})`);
  let t = parts.join(' ');
  if (date) t += `. Fecha: ${date}`;
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
      h('button', { class: 'btn btn-line', style: 'color:var(--moss)', onclick: () => openModal(p.id) }, 'Ver detalle'),
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
  $('#ofertas').hidden = false;

  const q = $('#q').value.trim().toLowerCase();
  const d = $('#dest').value;
  const list = visible.filter(p => (!d || p.destination === d) && (!q || `${p.title} ${p.destination}`.toLowerCase().includes(q)));
  const pc = $('#pkgCards'); pc.replaceChildren();
  if (list.length) list.forEach(p => pc.append(card(p)));
  else pc.append(h('div', { class: 'empty', style: 'grid-column:1/-1' }, visible.length ? 'No encontramos paquetes con ese filtro.' : 'Estamos cargando nuevos paquetes. Escribinos por WhatsApp y te asesoramos.'));
}

function fillDestinations() {
  const sel = $('#dest'); const cur = sel.value;
  const dests = [...new Set(packages.filter(p => p.status !== 'paused').map(p => p.destination).filter(Boolean))].sort();
  sel.replaceChildren(h('option', { value: '' }, 'Todos los destinos'), ...dests.map(x => h('option', { value: x }, x)));
  sel.value = dests.includes(cur) ? cur : '';
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
        h('div', { class: 'dest' }, p.destination || ''),
        h('h2', { id: 'mTitle' }, p.title),
        h('div', { class: 'meta' }, p.duration ? h('span', {}, '🗓 ' + p.duration) : null),
        p.description ? h('p', { style: 'margin-top:14px;color:#44504a' }, p.description) : null,
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

function applySettings() {
  const s = settings;
  $('#heroTitle').textContent = s.heroTitle;
  $('#heroText').textContent = s.heroText;
  $('#aboutText').textContent = s.about;
  const hi = safeImg(s.heroImage);
  if (hi) { const im = $('#heroImg'); im.src = hi; im.hidden = false; $('#heroArt').hidden = true; }
  const arma = s.armaUrl && /^https?:\/\//i.test(s.armaUrl) ? s.armaUrl : waLink(s.whatsapp, 'Hola Terromadas! Quiero armar mi viaje a medida.');
  ['#navArma', '#quickArma', '#bandArma'].forEach(i => $(i).href = arma);
  const wa = waLink(s.whatsapp, 'Hola Terromadas! Quiero hacer una consulta.');
  $('#fab').href = wa; $('#footWa').href = wa;
  if (s.instagram) { const ig = $('#footIg'); ig.href = 'https://instagram.com/' + s.instagram.replace(/^@/, '').replace(/[^\w.]/g, ''); ig.textContent = 'Instagram @' + s.instagram.replace(/^@/, ''); ig.hidden = false; }
  if (s.email) { const m = $('#footMail'); m.href = 'mailto:' + s.email; m.textContent = s.email; m.hidden = false; }
  if (s.city) $('#footCity').textContent = 'Agencia de viajes y turismo · ' + s.city;
}

async function init() {
  $('#year').textContent = new Date().getFullYear();
  const burger = $('#burger'), menu = $('#menu');
  burger.addEventListener('click', () => { const o = menu.classList.toggle('open'); burger.setAttribute('aria-expanded', o); });
  menu.addEventListener('click', e => { if (e.target.closest('a')) { menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); } });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal').classList.contains('open')) closeModal(); });
  $('#q').addEventListener('input', render);
  $('#dest').addEventListener('change', render);

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
