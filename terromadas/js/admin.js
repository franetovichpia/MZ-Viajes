import { CONFIG } from './config.js';
import { store, isDemo } from './store.js';
import { h, $, fmtPrice, safeImg, toast, uid } from './dom.js';

const app = $('#app');
let packages = [];
let external = [];
let settings = {};
let tab = 'paquetes';

const MAX = CONFIG.maxOffers;
const PHOTO_BUDGET = 850000; // caracteres base64 por paquete (límite de Firestore: 1 MB por documento)
const activeOffers = (ex) => packages.filter(p => p.offer && p.status !== 'paused' && p.id !== ex).sort((a, b) => (a.offerOrder || 0) - (b.offerOrder || 0));
const lines = t => t.split('\n').map(s => s.trim()).filter(Boolean);

/* ---------- imágenes ---------- */
function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('No se pudo leer la imagen')); i.src = src; });
}
async function toDataUrl(src, max, q) {
  let url = src, blobUrl;
  if (src instanceof Blob) url = blobUrl = URL.createObjectURL(src);
  try {
    const img = await loadImg(url);
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q);
  } finally { if (blobUrl) URL.revokeObjectURL(blobUrl); }
}
async function fit(list, budget = PHOTO_BUDGET) {
  const size = l => l.reduce((n, x) => n + x.length, 0);
  for (const [max, q] of [[1000, .6], [900, .5], [800, .42], [700, .35]]) {
    if (size(list) <= budget) return list;
    list = await Promise.all(list.map(x => toDataUrl(x, max, q)));
  }
  if (size(list) > budget) throw new Error('Las fotos son demasiado pesadas. Subí menos fotos.');
  return list;
}

/* ---------- login ---------- */
function showLogin() {
  const email = h('input', { type: 'email', id: 'em', autocomplete: 'username', required: true, placeholder: 'correo@ejemplo.com' });
  const pw = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', required: true });
  const err = h('div', { class: 'toast err', hidden: true, role: 'alert' });
  const form = h('form', { class: 'lbox', onsubmit: async e => {
    e.preventDefault(); err.hidden = true;
    try { await store.login(email.value.trim(), pw.value); if (isDemo) showPanel(); }
    catch (ex) { err.textContent = isDemo ? ex.message : 'Correo o contraseña incorrectos.'; err.hidden = false; pw.value = ''; }
  } },
    h('h1', {}, 'Panel de Terromadas'),
    isDemo ? h('div', { class: 'demo-note' }, 'MODO DEMO: los datos se guardan solo en este navegador. Contraseña: ', h('b', {}, CONFIG.demoPassword)) : null,
    h('div', { class: 'fld' }, h('label', { for: 'em' }, 'Correo'), email),
    h('div', { class: 'fld' }, h('label', { for: 'pw' }, 'Contraseña'), pw),
    err,
    h('button', { class: 'btn btn-clay', type: 'submit' }, 'Ingresar'),
    h('a', { href: 'index.html', style: 'text-align:center;font-size:14px' }, '← Volver al sitio'));
  app.replaceChildren(h('div', { class: 'login' }, form));
}

/* ---------- panel ---------- */
async function showPanel() {
  app.replaceChildren(h('p', { style: 'padding:30px' }, 'Cargando…'));
  try { [settings, packages, external] = await Promise.all([store.getSettings(), store.listPackages(), store.listExternal().catch(() => [])]); }
  catch (e) { toast('Error al cargar: ' + e.message, 'err'); }
  const inc = takeIncoming();
  if (inc) { tab = 'proveedor'; setTimeout(() => openIncoming(inc), 50); }
  renderPanel();
}

function renderPanel() {
  const tabs = [['paquetes', 'Paquetes'], ['ofertas', `Vidriera (${activeOffers().length}/${MAX})`], ['proveedor', `Proveedor (${external.length}/${CONFIG.maxExternal})`], ['ajustes', 'Ajustes']];
  app.replaceChildren(
    h('header', { class: 'top' }, h('div', { class: 'wrap' }, h('b', {}, 'Terromadas · Panel'),
      h('div', { style: 'display:flex;gap:8px' },
        h('a', { class: 'btn btn-line', href: 'index.html', target: '_blank', style: 'color:#fff' }, 'Ver sitio'),
        h('button', { class: 'btn btn-clay', onclick: () => store.logout().then(() => !isDemo || showLogin()) }, 'Salir')))),
    h('main', { class: 'wrap', style: 'padding-bottom:60px' },
      h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([k, l]) => h('button', { role: 'tab', 'aria-selected': tab === k, onclick: () => { tab = k; renderPanel(); } }, l))),
      tab === 'paquetes' ? viewPackages() : tab === 'ofertas' ? viewOffers() : tab === 'proveedor' ? viewExternal() : viewSettings()));
}

async function patch(id, data, msg) {
  try { await store.patchPackage(id, data); Object.assign(packages.find(p => p.id === id), data); renderPanel(); if (msg) toast(msg); }
  catch (e) { toast('No se pudo guardar: ' + e.message, 'err'); }
}

function capFull(ex) { return activeOffers(ex).length >= MAX; }
const CAP_MSG = `La vidriera ya tiene ${MAX} paquetes. Quitá uno en la pestaña "Vidriera" o reemplazalo.`;

/* ---------- vista paquetes ---------- */
function viewPackages() {
  const sorted = [...packages].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return h('div', {},
    h('div', { class: 'bar' }, h('h2', {}, `Paquetes (${packages.length})`), h('span', { class: 'count' }, `En vidriera: ${activeOffers().length} de ${MAX}`), h('button', { class: 'btn btn-clay', onclick: () => openForm(null) }, '+ Nuevo paquete')),
    sorted.length ? h('div', { class: 'list' }, sorted.map(rowFor)) : h('div', { class: 'empty' }, 'Todavía no cargaste paquetes. Tocá "Nuevo paquete".'));
}

function rowFor(p) {
  const st = { active: ['Disponible', ''], paused: ['Guardado', 'paused'], soldout: ['Agotado', 'soldout'] }[p.status] || ['Activo', ''];
  return h('div', { class: 'row' },
    safeImg(p.thumb) ? h('img', { src: p.thumb, alt: '' }) : h('div', { style: 'width:84px;height:64px;background:var(--sand2);border-radius:8px' }),
    h('div', {}, h('h3', {}, p.title), h('div', { class: 'sub' }, `${p.destination || '—'} · ${p.duration || '—'} · ${fmtPrice(p.price, p.currency)}`),
      h('div', { class: 'chips' }, h('span', { class: 'chip ' + st[1] }, st[0]), p.offer ? h('span', { class: 'chip offer' }, 'En vidriera') : null)),
    h('div', { class: 'acts' },
      p.status !== 'paused' ? h('button', { class: p.offer ? 'sm vid on' : 'sm vid', onclick: () => toggleVidriera(p) }, p.offer ? 'Sacar de la vidriera' : 'Poner en vidriera') : null,
      h('button', { class: 'sm edit', onclick: () => openForm(p) }, 'Editar'),
      h('button', { class: p.status === 'paused' ? 'sm ok' : 'sm hide', onclick: () => setStatus(p, p.status === 'paused' ? 'active' : 'paused') }, p.status === 'paused' ? 'Reactivar' : 'Guardar sin mostrar'),
      h('button', { class: p.status === 'soldout' ? 'sm ok' : 'sm sold', onclick: () => setStatus(p, p.status === 'soldout' ? 'active' : 'soldout') }, p.status === 'soldout' ? 'Hay cupo' : 'Marcar agotado'),
      h('button', { class: 'sm danger', onclick: () => del(p) }, 'Eliminar')));
}

function setStatus(p, status) {
  const data = status === 'paused' && p.offer ? { status, offer: false, offerOrder: 0 } : { status };
  patch(p.id, data, { active: 'Paquete disponible', paused: 'Paquete guardado (sale de la vidriera)', soldout: 'Marcado como agotado' }[status]);
}

function toggleVidriera(p) {
  if (p.offer) return patch(p.id, { offer: false, offerOrder: 0 }, 'Quitado de la vidriera');
  if (!capFull(p.id)) return patch(p.id, { offer: true, offerOrder: activeOffers(p.id).length + 1 }, 'Agregado a la vidriera');
  // Vidriera llena: se elige cuál sale para dejar lugar
  const modal = h('div', { class: 'modal open', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Reemplazar en la vidriera' });
  const close = () => { modal.remove(); document.body.style.overflow = ''; };
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  modal.append(h('div', { class: 'sheet formsheet' },
    h('button', { class: 'close', type: 'button', onclick: close, 'aria-label': 'Cerrar' }, '×'),
    h('div', { style: 'padding:24px;display:grid;gap:12px' },
      h('h2', { style: 'font-size:24px' }, 'La vidriera está llena'),
      h('p', {}, `Para mostrar "${p.title}" tenés que sacar uno. ¿Cuál reemplazás?`),
      activeOffers(p.id).map(c => h('button', { class: 'sm', style: 'text-align:left;padding:12px', onclick: async () => {
        const slot = c.offerOrder || 1;
        try {
          await store.patchPackage(c.id, { offer: false, offerOrder: 0 }); Object.assign(c, { offer: false, offerOrder: 0 });
          await store.patchPackage(p.id, { offer: true, offerOrder: slot }); Object.assign(p, { offer: true, offerOrder: slot });
          close(); renderPanel(); toast('Vidriera actualizada');
        } catch (ex) { toast('No se pudo guardar: ' + ex.message, 'err'); }
      } }, `Sacar "${c.title}"`)))));
  document.body.append(modal); document.body.style.overflow = 'hidden';
}

async function del(p) {
  if (!confirm(`¿Eliminar "${p.title}" definitivamente?\n\nSi solo querés que no se vea, usá "Pausar".`)) return;
  try { await store.deletePackage(p.id); packages = packages.filter(x => x.id !== p.id); renderPanel(); toast('Paquete eliminado'); }
  catch (e) { toast('No se pudo eliminar: ' + e.message, 'err'); }
}

/* ---------- vista ofertas ---------- */
function viewOffers() {
  const offers = activeOffers();
  const candidates = packages.filter(p => p.status === 'active' && !p.offer);
  const swap = (slot, current) => {
    const sel = h('select', { 'aria-label': current ? 'Reemplazar por' : 'Agregar a la vidriera', onchange: async e => {
      const id = e.target.value; if (!id) return;
      try {
        if (current) await store.patchPackage(current.id, { offer: false, offerOrder: 0 }), Object.assign(current, { offer: false, offerOrder: 0 });
        const np = packages.find(x => x.id === id);
        await store.patchPackage(id, { offer: true, offerOrder: slot }); Object.assign(np, { offer: true, offerOrder: slot });
        renderPanel(); toast('Vidriera actualizada');
      } catch (ex) { toast('No se pudo guardar: ' + ex.message, 'err'); }
    } }, h('option', { value: '' }, current ? 'Reemplazar por…' : 'Elegir paquete…'), candidates.map(c => h('option', { value: c.id }, c.title)));
    return h('div', { class: 'fld' }, sel);
  };
  const slots = Array.from({ length: MAX }, (_, i) => {
    const cur = offers[i];
    return h('div', { class: 'slot' + (cur ? ' on' : '') },
      h('b', {}, `Lugar ${i + 1}`),
      cur ? [safeImg(cur.thumb) ? h('img', { src: cur.thumb, alt: '' }) : null, h('div', {}, h('b', {}, cur.title), h('div', { class: 'sub' }, fmtPrice(cur.price, cur.currency))),
        h('button', { class: 'sm danger', onclick: () => patch(cur.id, { offer: false, offerOrder: 0 }, 'Quitado de la vidriera') }, 'Quitar de la vidriera')] : h('div', { class: 'sub' }, 'Lugar libre'),
      candidates.length ? swap(i + 1, cur) : null);
  });
  // si hay ofertas con orden repetido, normalizamos al mostrar posiciones
  return h('div', {},
    h('div', { class: 'bar' }, h('h2', {}, 'Vidriera del sitio'), h('span', { class: 'count' }, `${offers.length} de ${MAX} lugares`)),
    h('p', { class: 'help', style: 'margin-bottom:16px' }, `La vidriera muestra hasta ${MAX} paquetes o promos propios, cada uno con su botón de WhatsApp. Cambialos o reemplazalos cuando quieras, sin costo. Para aparecer tiene que estar activo.`),
    h('div', { class: 'slots' }, slots));
}

/* ---------- formulario de paquete ---------- */
async function openForm(pkg) {
  const isNew = !pkg;
  const p = pkg ? { ...pkg } : { id: uid(), status: 'active', offer: false, offerOrder: 0, currency: 'ARS', priceNote: 'por persona', createdAt: Date.now() };
  let photos = []; let changed = false;
  const modal = h('div', { class: 'modal open', role: 'dialog', 'aria-modal': 'true', 'aria-label': isNew ? 'Nuevo paquete' : 'Editar paquete' });
  const sheet = h('div', { class: 'sheet formsheet' });
  modal.append(sheet); document.body.append(modal); document.body.style.overflow = 'hidden';
  const close = () => { modal.remove(); document.body.style.overflow = ''; };
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  sheet.append(h('p', { style: 'padding:24px' }, 'Cargando…'));
  if (!isNew) { try { photos = await store.getPhotos(p.id); } catch { photos = []; } }

  const f = {
    title: h('input', { value: p.title || '', required: true, maxlength: 80 }),
    destination: h('input', { value: p.destination || '', required: true, maxlength: 80, placeholder: 'Ej: Bariloche, Río Negro' }),
    duration: h('input', { value: p.duration || '', maxlength: 40, placeholder: 'Ej: 7 noches' }),
    price: h('input', { type: 'number', min: 0, step: 1, value: p.price ?? '', inputmode: 'numeric' }),
    oldPrice: h('input', { type: 'number', min: 0, step: 1, value: p.oldPrice ?? '', inputmode: 'numeric' }),
    currency: h('select', {}, ['ARS', 'USD'].map(c => h('option', { value: c, selected: p.currency === c }, c === 'ARS' ? 'Pesos ($)' : 'Dólares (USD)'))),
    priceNote: h('input', { value: p.priceNote ?? '', maxlength: 40, placeholder: 'por persona' }),
    dates: h('textarea', { placeholder: '12/12/2026 al 19/12/2026\n09/01/2027 al 16/01/2027' }, (p.dates || []).join('\n')),
    description: h('textarea', { maxlength: 1200 }, p.description || ''),
    includes: h('textarea', { placeholder: 'Aéreo ida y vuelta\nTraslados\n7 noches de hotel' }, (p.includes || []).join('\n')),
    category: h('select', {}, [h('option', { value: '' }, 'Sin tipo'), ...CONFIG.categories.map(c => h('option', { value: c, selected: p.category === c }, c))]),
    status: h('select', {}, [['active', 'Disponible'], ['paused', 'Guardado (no se muestra en el sitio)'], ['soldout', 'Agotado']].map(([v, l]) => h('option', { value: v, selected: p.status === v }, l))),
    offer: h('input', { type: 'checkbox', checked: !!p.offer, id: 'offchk' })
  };
  const fld = (label, el, hint) => h('div', { class: 'fld' }, h('label', {}, label), el, hint ? h('small', {}, hint) : null);
  const photoBox = h('div', { class: 'photos' });
  const drawPhotos = () => photoBox.replaceChildren(...photos.map((src, i) => h('div', { class: 'ph' }, h('img', { src, alt: '' }),
    h('div', {}, i > 0 ? h('button', { type: 'button', title: 'Hacer principal', onclick: () => { photos.unshift(photos.splice(i, 1)[0]); changed = true; drawPhotos(); } }, '★') : h('span', { style: 'flex:1;color:#fff;font-size:11px;padding:6px' }, 'Principal'),
      h('button', { type: 'button', title: 'Quitar', onclick: () => { photos.splice(i, 1); changed = true; drawPhotos(); } }, '✕')))));
  drawPhotos();
  const file = h('input', { type: 'file', accept: 'image/*', multiple: true, onchange: async e => {
    const files = [...e.target.files].slice(0, 5 - photos.length); e.target.value = '';
    if (!files.length) return toast('Máximo 5 fotos por paquete', 'err');
    try { const add = await Promise.all(files.map(x => toDataUrl(x, 1100, .72))); photos = await fit([...photos, ...add]); changed = true; drawPhotos(); }
    catch (ex) { toast(ex.message, 'err'); }
  } });

  const save = h('button', { class: 'btn btn-clay', type: 'submit' }, 'Guardar paquete');
  const form = h('form', { onsubmit: async e => {
    e.preventDefault();
    const status = f.status.value, offer = f.offer.checked;
    if (offer && status !== 'paused' && capFull(p.id)) return toast(CAP_MSG, 'err');
    const out = { ...p, title: f.title.value.trim(), destination: f.destination.value.trim(), duration: f.duration.value.trim(),
      price: f.price.value === '' ? null : Number(f.price.value), oldPrice: f.oldPrice.value === '' ? null : Number(f.oldPrice.value),
      currency: f.currency.value, priceNote: f.priceNote.value.trim(), dates: lines(f.dates.value), description: f.description.value.trim(),
      includes: lines(f.includes.value), category: f.category.value, status, offer: offer && status !== 'paused', offerOrder: offer && status !== 'paused' ? (p.offerOrder || (activeOffers(p.id).length + 1)) : 0 };
    save.disabled = true; save.textContent = 'Guardando…';
    try {
      if (changed) out.thumb = photos[0] ? await toDataUrl(photos[0], 480, .7) : '';
      await store.savePackage(out, changed ? photos : undefined);
      const i = packages.findIndex(x => x.id === out.id); if (i >= 0) packages[i] = out; else packages.push(out);
      close(); renderPanel(); toast('Paquete guardado ✔');
    } catch (ex) { toast('No se pudo guardar: ' + ex.message, 'err'); save.disabled = false; save.textContent = 'Guardar paquete'; }
  } },
    h('h2', { style: 'font-size:26px' }, isNew ? 'Nuevo paquete' : 'Editar paquete'),
    fld('Nombre del paquete', f.title), fld('Destino', f.destination),
    h('div', { class: 'two' }, fld('Duración', f.duration), fld('Tipo de viaje', f.category)),
    fld('Estado', f.status, '"Disponible" y "Agotado" pueden ir en la vidriera. "Guardado" lo deja solo en el panel, sin mostrarlo.'),
    h('div', { class: 'two' }, fld('Precio', f.price), fld('Moneda', f.currency)),
    h('div', { class: 'two' }, fld('Precio anterior (opcional)', f.oldPrice, 'Se muestra tachado'), fld('Aclaración del precio', f.priceNote)),
    fld('Fechas de salida', f.dates, 'Una por línea'),
    fld('Descripción', f.description),
    fld('Qué incluye', f.includes, 'Un ítem por línea'),
    h('div', { class: 'fld' }, h('label', {}, `Fotos (hasta 5, la primera es la principal)`), file, photoBox),
    h('label', { style: 'display:flex;gap:10px;align-items:center;font-weight:700' }, f.offer, `Mostrar en la vidriera del sitio (máximo ${MAX})`),
    h('div', { style: 'display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap' }, h('button', { class: 'btn btn-line', type: 'button', style: 'color:var(--ink)', onclick: close }, 'Cancelar'), save));
  sheet.replaceChildren(h('button', { class: 'close', type: 'button', onclick: close, 'aria-label': 'Cerrar' }, '×'), form);
}


/* ---------- proveedor (paquetes externos, máx. 5) ---------- */
// Datos que llegan desde el marcador "Agregar a Terromadas" (se abre desde terromadasviajes.com)
function takeIncoming() {
  const m = /^#agregar=(.+)$/.exec(location.hash);
  if (!m) return null;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const d = JSON.parse(decodeURIComponent(m[1]));
    return { title: String(d.title || '').slice(0, 80), url: String(d.url || ''), imageUrl: String(d.imageUrl || ''), price: String(d.price || '').slice(0, 40) };
  } catch { return null; }
}
function openIncoming(d) {
  if (external.length >= CONFIG.maxExternal) return toast(`Ya hay ${CONFIG.maxExternal} cargadas. Eliminá una para agregar la nueva.`, 'err');
  if (external.some(e => e.url === d.url)) return toast('Esa salida ya está cargada.', 'err');
  openExternalForm(null, d);
}

// Marcador para la barra del navegador: lee la página del paquete abierta y la manda a este panel
function bookmarkletHref() {
  const target = location.origin + location.pathname;
  const code = "(function(){if(!/\\/es\\/idea\\//.test(location.pathname)){alert('Primero abrí un paquete (la página con el detalle del viaje) y volvé a tocar este botón.');return}var m=function(p){var e=document.querySelector('meta[property=\"'+p+'\"]');return e?e.content:''};var t=m('og:title'),i=m('og:image'),pr='';var x=/^(.*?)\\s+desde\\s+(US\\$\\s?[\\d.,]+)\\s*$/i.exec(t);if(x){t=x[1];pr='Desde '+x[2].replace(/(\\d),(\\d{3})/g,'$1.$2')+' por persona'}var d={title:t,url:location.href.split('#')[0],imageUrl:i,price:pr};window.open('" + target + "#agregar='+encodeURIComponent(JSON.stringify(d)),'_blank')})();";
  return 'javascript:' + encodeURIComponent(code);
}

function viewExternal() {
  const list = [...external].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const full = list.length >= CONFIG.maxExternal;
  const bm = h('a', { href: bookmarkletHref(), class: 'btn btn-clay', style: 'padding:6px 14px;min-height:34px;font-size:14px;cursor:grab', title: 'Arrastralo a la barra de marcadores', onclick: e => { e.preventDefault(); toast('No hagas clic: arrastralo a la barra de marcadores del navegador', 'err'); } }, '➕ Agregar a Terromadas');
  return h('div', {},
    h('div', { class: 'bar' }, h('h2', {}, `Más opciones (${list.length}/${CONFIG.maxExternal})`),
      h('button', { class: 'btn btn-clay', disabled: full, onclick: () => openExternalForm(null) }, '+ Agregar a mano')),
    h('p', { class: 'help', style: 'margin-bottom:12px' }, `Salidas de ${CONFIG.externalHost} que se muestran en el sitio como "Salidas y paquetes recientes". El cliente que elige una va directo a esa página. Se muestran hasta ${CONFIG.maxExternal}: para agregar otra cuando ya hay ${CONFIG.maxExternal}, eliminá una.`),
    h('div', { class: 'help', style: 'margin-bottom:16px' },
      h('b', {}, 'Cargar una salida en 15 segundos'),
      h('ol', { style: 'margin:8px 0 0 18px;padding:0;display:grid;gap:6px' },
        h('li', {}, 'Una sola vez: arrastrá este botón a la barra de marcadores del navegador (Chrome o Edge, en la compu): ', bm),
        h('li', {}, `Entrá a ${CONFIG.externalHost} y abrí el paquete que querés mostrar (la página con el detalle).`),
        h('li', {}, 'Tocá el marcador "Agregar a Terromadas". Se abre este panel con el título, el precio, la foto y el link ya cargados: revisá y tocá Guardar.'))),
    list.length ? h('div', { class: 'list' }, list.map(x => h('div', { class: 'row' },
      (safeImg(x.image) || x.imageUrl) ? h('img', { src: safeImg(x.image) || x.imageUrl, alt: '', referrerpolicy: 'no-referrer' }) : h('div', { style: 'width:84px;height:64px;background:var(--sand2);border-radius:8px' }),
      h('div', {}, h('h3', {}, x.title), h('div', { class: 'sub' }, [x.subtitle, x.price].filter(Boolean).join(' · ') || '—'), h('div', { class: 'sub', style: 'word-break:break-all' }, x.url)),
      h('div', { class: 'acts' },
        h('button', { class: 'sm edit', onclick: () => openExternalForm(x) }, 'Editar'),
        h('button', { class: 'sm danger', onclick: async () => {
          if (!confirm(`¿Eliminar "${x.title}"?`)) return;
          try { await store.deleteExternal(x.id); external = external.filter(e => e.id !== x.id); renderPanel(); toast('Eliminado'); }
          catch (e) { toast('No se pudo eliminar: ' + e.message, 'err'); }
        } }, 'Eliminar'))))) : h('div', { class: 'empty' }, 'Todavía no cargaste salidas del proveedor.'));
}

function viewExternalOld() {
  const list = [...external].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const full = list.length >= CONFIG.maxExternal;
  return h('div', {},
    h('div', { class: 'bar' }, h('h2', {}, `Más opciones (${list.length}/${CONFIG.maxExternal})`),
      h('button', { class: 'btn btn-clay', disabled: full, onclick: () => openExternalForm(null) }, '+ Agregar')),
    h('p', { class: 'help', style: 'margin-bottom:16px' }, `Las salidas más nuevas de ${CONFIG.externalHost} se muestran solas en el sitio, no hace falta cargar nada. Usá esta lista solo si querés destacar una salida puntual: aparece primero. En total el sitio muestra como máximo ${CONFIG.maxExternal}.`),
    list.length ? h('div', { class: 'list' }, list.map(x => h('div', { class: 'row' },
      (safeImg(x.image) || x.imageUrl) ? h('img', { src: safeImg(x.image) || x.imageUrl, alt: '', referrerpolicy: 'no-referrer' }) : h('div', { style: 'width:84px;height:64px;background:var(--sand2);border-radius:8px' }),
      h('div', {}, h('h3', {}, x.title), h('div', { class: 'sub' }, [x.subtitle, x.price].filter(Boolean).join(' · ') || '—'), h('div', { class: 'sub', style: 'word-break:break-all' }, x.url)),
      h('div', { class: 'acts' },
        h('button', { class: 'sm edit', onclick: () => openExternalForm(x) }, 'Editar'),
        h('button', { class: 'sm danger', onclick: async () => {
          if (!confirm(`¿Eliminar "${x.title}"?`)) return;
          try { await store.deleteExternal(x.id); external = external.filter(e => e.id !== x.id); renderPanel(); toast('Eliminado'); }
          catch (e) { toast('No se pudo eliminar: ' + e.message, 'err'); }
        } }, 'Eliminar'))))) : h('div', { class: 'empty' }, 'Todavía no cargaste salidas del proveedor.'));
}

function openExternalForm(item, prefill) {
  const isNew = !item;
  const x = item ? { ...item } : { id: uid(), createdAt: Date.now(), ...(prefill || {}) };
  let image = x.image || ''; let changed = false;
  const modal = h('div', { class: 'modal open', role: 'dialog', 'aria-modal': 'true', 'aria-label': isNew ? 'Agregar del proveedor' : 'Editar' });
  const sheet = h('div', { class: 'sheet formsheet' });
  modal.append(sheet); document.body.append(modal); document.body.style.overflow = 'hidden';
  const close = () => { modal.remove(); document.body.style.overflow = ''; };
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  const f = {
    title: h('input', { value: x.title || '', required: true, maxlength: 80 }),
    url: h('input', { type: 'url', value: x.url || '', required: true, placeholder: `https://www.${CONFIG.externalHost}/...` }),
    subtitle: h('input', { value: x.subtitle || '', maxlength: 80, placeholder: 'Ej: Punta Cana · 7 noches' }),
    price: h('input', { value: x.price || '', maxlength: 40, placeholder: 'Ej: Desde USD 1.499' }),
    imageUrl: h('input', { type: 'url', value: x.imageUrl || '', placeholder: 'https://...' })
  };
  const fld = (label, el, hint) => h('div', { class: 'fld' }, h('label', {}, label), el, hint ? h('small', {}, hint) : null);
  const prev = h('img', { alt: '', referrerpolicy: 'no-referrer', style: 'max-width:220px;border-radius:10px', hidden: !(safeImg(image) || x.imageUrl), src: safeImg(image) || x.imageUrl || undefined });
  f.imageUrl.addEventListener('input', () => { const u = f.imageUrl.value.trim(); if (/^https:\/\//i.test(u)) { prev.src = u; prev.hidden = false; } });
  const file = h('input', { type: 'file', accept: 'image/*', onchange: async e => {
    const fl = e.target.files[0]; if (!fl) return;
    try { const [d] = await fit([await toDataUrl(fl, 800, .7)], 250000); image = d; changed = true; prev.src = d; prev.hidden = false; }
    catch (ex) { toast(ex.message, 'err'); }
  } });
  const save = h('button', { class: 'btn btn-clay', type: 'submit' }, 'Guardar');
  const form = h('form', { onsubmit: async e => {
    e.preventDefault();
    let host = '';
    try { const u = new URL(f.url.value.trim()); host = u.protocol === 'https:' ? u.hostname.replace(/^www\./, '') : ''; } catch {}
    if (!(host === CONFIG.externalHost || host.endsWith('.' + CONFIG.externalHost))) return toast(`El link tiene que ser de ${CONFIG.externalHost} y empezar con https://`, 'err');
    const iu = f.imageUrl.value.trim();
    if (iu && !/^https:\/\//i.test(iu)) return toast('El link de la foto tiene que empezar con https://', 'err');
    if (!image && !iu) return toast('Subí una foto o pegá el link de la foto', 'err');
    const out = { ...x, title: f.title.value.trim(), url: f.url.value.trim(), subtitle: f.subtitle.value.trim(), price: f.price.value.trim(), image, imageUrl: iu };
    save.disabled = true; save.textContent = 'Guardando…';
    try {
      await store.saveExternal(out);
      const i = external.findIndex(e2 => e2.id === out.id); if (i >= 0) external[i] = out; else external.push(out);
      close(); renderPanel(); toast('Guardado ✔');
    } catch (ex) { toast('No se pudo guardar: ' + ex.message, 'err'); save.disabled = false; save.textContent = 'Guardar'; }
  } },
    h('h2', { style: 'font-size:26px' }, isNew ? 'Agregar salida del proveedor' : 'Editar'),
    fld('Título', f.title),
    fld(`Link a ${CONFIG.externalHost}`, f.url, 'Copiá la dirección de la página del paquete y pegala acá'),
    fld('Detalle breve (opcional)', f.subtitle),
    fld('Precio (opcional, texto libre)', f.price),
    fld('Link de la foto (opcional)', f.imageUrl, 'Clic derecho sobre la foto en terromadasviajes.com → "Copiar dirección de la imagen" y pegala acá. Si preferís, subí el archivo abajo.'),
    h('div', { class: 'fld' }, h('label', {}, 'O subí la foto desde tu compu'), file, prev),
    h('div', { style: 'display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap' }, h('button', { class: 'btn btn-line', type: 'button', style: 'color:var(--ink)', onclick: close }, 'Cancelar'), save));
  sheet.replaceChildren(h('button', { class: 'close', type: 'button', onclick: close, 'aria-label': 'Cerrar' }, '×'), form);
}

/* ---------- ajustes ---------- */
function viewSettings() {
  const s = { ...settings };
  const mk = (k, label, props = {}, hint, tag = 'input') => {
    const el = tag === 'textarea' ? h('textarea', props, s[k] || '') : h('input', { value: s[k] || '', ...props });
    el.addEventListener('input', () => { s[k] = el.value; });
    return h('div', { class: 'fld' }, h('label', {}, label), el, hint ? h('small', {}, hint) : null);
  };
  const heroPrev = h('img', { alt: '', style: 'max-width:240px;border-radius:8px', hidden: !safeImg(s.heroImage), src: safeImg(s.heroImage) || undefined });
  const heroFile = h('input', { type: 'file', accept: 'image/*', onchange: async e => {
    const x = e.target.files[0]; if (!x) return;
    try { const [d] = await fit([await toDataUrl(x, 1600, .6)], 400000); s.heroImage = d; heroPrev.src = d; heroPrev.hidden = false; } catch (ex) { toast(ex.message, 'err'); }
  } });
  const aboutPrev = h('img', { alt: '', style: 'max-width:200px;border-radius:12px', hidden: !safeImg(s.aboutImage), src: safeImg(s.aboutImage) || undefined });
  const aboutFile = h('input', { type: 'file', accept: 'image/*', onchange: async e => {
    const x = e.target.files[0]; if (!x) return;
    try { const [d] = await fit([await toDataUrl(x, 900, .7)], 300000); s.aboutImage = d; aboutPrev.src = d; aboutPrev.hidden = false; } catch (ex) { toast(ex.message, 'err'); }
  } });
  const photoField = n => {
    const cur = () => safeImg(s['q15Img' + n]) || s['q15ImgUrl' + n] || '';
    const prev = h('img', { alt: '', referrerpolicy: 'no-referrer', style: 'max-width:160px;border-radius:10px', hidden: !cur(), src: cur() || undefined });
    const file = h('input', { type: 'file', accept: 'image/*', onchange: async e => {
      const x = e.target.files[0]; if (!x) return;
      try { const [d] = await fit([await toDataUrl(x, 800, .7)], 150000); s['q15Img' + n] = d; prev.src = d; prev.hidden = false; } catch (ex) { toast(ex.message, 'err'); }
    } });
    const link = h('input', { type: 'url', value: s['q15ImgUrl' + n] || '', placeholder: 'https://... (opcional, en vez de subir un archivo)' });
    link.addEventListener('input', () => { s['q15ImgUrl' + n] = link.value.trim(); if (/^https:\/\//i.test(link.value.trim())) { prev.src = link.value.trim(); prev.hidden = false; } });
    const clear = h('button', { class: 'sm', type: 'button', onclick: () => { delete s['q15Img' + n]; s['q15ImgUrl' + n] = ''; link.value = ''; prev.hidden = true; } }, 'Quitar foto');
    return h('div', { class: 'fld' }, h('label', {}, `Documento ${n}: foto de la tarjeta`), file, link, prev, clear);
  };
  return h('form', { style: 'display:grid;gap:14px;max-width:640px', onsubmit: async e => {
    e.preventDefault();
    if (!/^\d{10,15}$/.test(String(s.whatsapp).replace(/\D/g, ''))) return toast('Revisá el número de WhatsApp (con código de país, ej: 5491112345678)', 'err');
    if (s.armaUrl && !/^https?:\/\//i.test(s.armaUrl)) return toast('El link de "Armá tu viaje" debe empezar con https://', 'err');
    for (const n of [1, 2, 3, 4]) if (s['q15Url' + n] && !/^https:\/\//i.test(s['q15Url' + n])) return toast(`El link del documento ${n} tiene que empezar con https://`, 'err');
    for (const n of [1, 2, 3, 4]) if (s['q15ImgUrl' + n] && !/^https:\/\//i.test(s['q15ImgUrl' + n])) return toast(`El link de la foto del documento ${n} tiene que empezar con https://`, 'err');
    try { await store.saveSettings({ ...s, whatsapp: String(s.whatsapp).replace(/\D/g, '') }); settings = s; toast('Ajustes guardados ✔'); }
    catch (ex) { toast('No se pudo guardar: ' + ex.message, 'err'); }
  } },
    h('h2', {}, 'Ajustes del sitio'),
    mk('whatsapp', 'WhatsApp de consultas', { inputmode: 'numeric', required: true }, 'Con código de país y sin signos. Argentina celular: 549 + área + número'),
    mk('armaUrl', 'Link del botón "Armá tu viaje"', { type: 'url', placeholder: 'https://www.terromadasviajes.com' }, 'A dónde lleva el botón. Si lo dejás vacío, abre WhatsApp'),
    mk('heroTitle', 'Título de inicio (línea 1, oscura)', { maxlength: 60 }),
    mk('heroTitle2', 'Título de inicio (línea 2, roja)', { maxlength: 60 }),
    mk('heroScript', 'Frase manuscrita de inicio', { maxlength: 100 }),
    mk('heroText', 'Texto de inicio', { maxlength: 220 }, '', 'textarea'),
    mk('about', 'Historia (Nosotros). Separá los párrafos con una línea en blanco', { maxlength: 1800 }, '', 'textarea'),
    mk('owner', 'Nombre de la titular (firma)'),
    mk('ownerRole', 'Cargo o título de la titular'),
    mk('address', 'Dirección de la agencia'),
    mk('hours', 'Horario de atención'),
    mk('legajo', 'Legajo o habilitación (ej: Legajo RNAV 19334)'),
    mk('instagram', 'Instagram (usuario)', { placeholder: 'terromadas' }),
    mk('facebook', 'Facebook (usuario o página, opcional)'),
    mk('tiktok', 'TikTok (usuario, opcional)'),
    mk('q15Title', 'Banner "Viajes de 15": título', { maxlength: 60 }),
    mk('q15Text', 'Banner "Viajes de 15": texto', { maxlength: 200 }, '', 'textarea'),
    mk('q15Label1', 'Documento 1: nombre del botón', { maxlength: 40, placeholder: 'Ej: Bariloche 2027' }),
    mk('q15Url1', 'Documento 1: link del PDF', { type: 'url', placeholder: 'https://drive.google.com/...' }, 'Subí el PDF a Google Drive → Compartir → "Cualquier persona con el enlace" → Copiar enlace. Si dejás los links vacíos, el banner no se muestra.'),
    mk('q15Label2', 'Documento 2: nombre del botón', { maxlength: 40 }),
    mk('q15Url2', 'Documento 2: link del PDF', { type: 'url', placeholder: 'https://...' }),
    mk('q15Label3', 'Documento 3: nombre del botón', { maxlength: 40 }),
    mk('q15Url3', 'Documento 3: link del PDF', { type: 'url', placeholder: 'https://...' }),
    mk('q15Label4', 'Documento 4: nombre del botón', { maxlength: 40 }),
    mk('q15Url4', 'Documento 4: link del PDF', { type: 'url', placeholder: 'https://...' }),
    ...[1, 2, 3, 4].map(photoField),
    mk('email', 'Email de contacto (opcional)', { type: 'email' }),
    mk('city', 'Ciudad / zona (opcional)'),
    h('div', { class: 'fld' }, h('label', {}, 'Foto principal de inicio (opcional)'), heroFile, heroPrev),
    h('div', { class: 'fld' }, h('label', {}, 'Foto de la titular, sección Nosotros (opcional)'), aboutFile, aboutPrev),
    h('button', { class: 'btn btn-clay', type: 'submit', style: 'justify-self:start' }, 'Guardar ajustes'),
    isDemo ? h('button', { class: 'sm', type: 'button', onclick: async () => { if (confirm('¿Volver a los datos de ejemplo?')) { await store.resetDemo(); showPanel(); } } }, 'Reiniciar datos de ejemplo (demo)') : null);
}

/* ---------- arranque ---------- */
store.onAuth(user => { if (user) showPanel(); else showLogin(); });
