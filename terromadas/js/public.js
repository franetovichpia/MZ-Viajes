import { CONFIG } from './config.js';
import { store } from './store.js';
import { h, $, fmtPrice, waLink, safeImg, toast } from './dom.js';

let settings = CONFIG.defaults;
let packages = [];
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

/* ---------- paquetes propios (máx. 10 por tipo) ---------- */
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
      h('button', { class: 'btn btn-detail', onclick: () => openModal(p.id) }, 'Ver detalle'),
      sold
        ? h('span', { class: 'btn btn-wa', 'aria-disabled': 'true' }, 'Agotado')
        : h('a', { class: 'btn btn-wa', href: waLink(waNumber(), consultText(p)), target: '_blank', rel: 'noopener noreferrer' }, 'Consultar')));
}

let filtro = '';

function render() {
  const vis = packages.filter(p => p.status !== 'paused').map(p => ({ ...p, category: CONFIG.categories.includes(p.category) ? p.category : 'Otros' }));
  const cats = CONFIG.categories.filter(c => vis.some(p => p.category === c));
  if (filtro && !cats.includes(filtro)) filtro = '';
  const f = $('#vidFilters');
  f.replaceChildren(...(cats.length > 1 ? [['', 'Todos'], ...cats.map(c => [c, c])].map(([v, l]) =>
    h('button', { class: 'fchip', type: 'button', 'aria-pressed': filtro === v, onclick: () => { filtro = v; render(); } }, l)) : []));
  const list = [];
  for (const c of cats) if (!filtro || filtro === c) list.push(...vis.filter(p => p.category === c).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, CONFIG.maxPerCategory));
  const vc = $('#vidCards'); vc.replaceChildren();
  if (list.length) list.forEach(p => vc.append(card(p)));
  else vc.append(h('div', { class: 'empty', style: 'grid-column:1/-1' }, 'Estamos actualizando nuestros paquetes. Escribinos por WhatsApp y te asesoramos.'));
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
  const docs = [1, 2, 3, 4].map(n => ({ label: s['q15Label' + n], url: s['q15Url' + n], img: s['q15Img' + n], imgUrl: s['q15ImgUrl' + n] })).filter(d => /^(https:\/\/|docs\/)/i.test(d.url || ''));
  const dl = s.q15Mode === 'descargar';
  const downloadUrl = u => { const m = /drive\.google\.com\/file\/d\/([\w-]+)/.exec(u); return m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : u; };
  $('#quince').hidden = !docs.length; $('#navQ15').hidden = !docs.length;
  if (docs.length) {
    $('#q15Title').textContent = s.q15Title || 'Viajes de 15';
    $('#q15Text').textContent = s.q15Text || '';
    $('#q15Docs').replaceChildren(...docs.map(d => {
      const ic = document.createElement('span');
      ic.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>';
      const img = safeImg(d.img) || (/^https:\/\//i.test(d.imgUrl || '') ? d.imgUrl : '');
      return h('a', { class: 'q15-card', href: dl ? downloadUrl(d.url) : d.url, target: '_blank', rel: 'noopener noreferrer', download: dl && /^docs\//.test(d.url) ? '' : null },
        img ? h('img', { src: img, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onerror: e => { const ph = document.createElement('span'); ph.className = 'q15-ph'; e.currentTarget.replaceWith(ph); } }) : h('span', { class: 'q15-ph' }),
        h('span', { class: 'q15-cap' }, h('b', {}, d.label || 'Ver información'), h('span', {}, ic.firstChild, dl ? 'Descargar PDF' : 'Ver información')));
    }));
  }
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

// Salidas de terromadasviajes.com: primero el servicio en vivo (Worker); si falla, el archivo guardado
async function loadAuto() {
  for (const u of [CONFIG.proveedorApi]) {
    if (!u) continue;
    const list = await loadAutoFrom(u);
    if (list.length) return list;
  }
  return [];
}

async function loadAutoFrom(url) {
  try {
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    const j = await r.json();
    const list = Array.isArray(j.items) ? j.items : [];
    return list.map((x, i) => ({ id: 'auto' + x.id, title: x.title, subtitle: x.subtitle || '', price: x.price || '', url: x.url, imageUrl: x.imageUrl, createdAt: list.length - i }));
  } catch { return []; }
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
    [settings, packages] = await Promise.all([store.getSettings(), store.listPackages()]);
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
