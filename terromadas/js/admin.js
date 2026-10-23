import { CONFIG } from './config.js';
import { store, isDemo } from './store.js';
import { h, $, fmtPrice, safeImg, toast, uid } from './dom.js';

const app = $('#app');
let packages = [];
let settings = {};
let tab = 'paquetes';

const MAX = CONFIG.maxPerCategory;
const PHOTO_BUDGET = 850000; // caracteres base64 por paquete (límite de Firestore: 1 MB por documento)
const shown = (cat, ex) => packages.filter(p => (CONFIG.categories.includes(p.category) ? p.category : 'Otros') === cat && p.status !== 'paused' && p.id !== ex);
const full = (cat, ex) => shown(cat, ex).length >= MAX;
const catMsg = cat => `"${cat}" ya tiene ${MAX} paquetes visibles. Guardá o eliminá uno de ese tipo para poder mostrar otro.`;
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
  try { [settings, packages] = await Promise.all([store.getSettings(), store.listPackages()]); }
  catch (e) { toast('Error al cargar: ' + e.message, 'err'); }
  renderPanel();
}

function renderPanel() {
  const tabs = [['paquetes', 'Paquetes'], ['ajustes', 'Ajustes']];
  app.replaceChildren(
    h('header', { class: 'top' }, h('div', { class: 'wrap' }, h('b', {}, 'Terromadas · Panel'),
      h('div', { style: 'display:flex;gap:8px' },
        h('a', { class: 'btn btn-line', href: 'index.html', target: '_blank', style: 'color:#fff' }, 'Ver sitio'),
        h('button', { class: 'btn btn-clay', onclick: () => store.logout().then(() => !isDemo || showLogin()) }, 'Salir')))),
    h('main', { class: 'wrap', style: 'padding-bottom:60px' },
      h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([k, l]) => h('button', { role: 'tab', 'aria-selected': tab === k, onclick: () => { tab = k; renderPanel(); } }, l))),
      tab === 'paquetes' ? viewPackages() : viewSettings()));
}

async function patch(id, data, msg) {
  try { await store.patchPackage(id, data); Object.assign(packages.find(p => p.id === id), data); renderPanel(); if (msg) toast(msg); }
  catch (e) { toast('No se pudo guardar: ' + e.message, 'err'); }
}


/* ---------- vista paquetes ---------- */
function viewPackages() {
  const sorted = [...packages].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return h('div', {},
    h('div', { class: 'bar' }, h('h2', {}, `Paquetes (${packages.length})`), h('button', { class: 'btn btn-clay', onclick: () => openForm(null) }, '+ Nuevo paquete')),
    h('div', { class: 'chips', style: 'margin-bottom:14px' }, CONFIG.categories.map(c => h('span', { class: 'chip' + (shown(c).length >= MAX ? ' soldout' : '') }, `${c}: ${shown(c).length}/${MAX} visibles`))),
    sorted.length ? h('div', { class: 'list' }, sorted.map(rowFor)) : h('div', { class: 'empty' }, 'Todavía no cargaste paquetes. Tocá "Nuevo paquete".'));
}

function rowFor(p) {
  const st = { active: ['Disponible', ''], paused: ['Guardado', 'paused'], soldout: ['Agotado', 'soldout'] }[p.status] || ['Activo', ''];
  return h('div', { class: 'row' },
    safeImg(p.thumb) ? h('img', { src: p.thumb, alt: '' }) : h('div', { style: 'width:84px;height:64px;background:var(--sand2);border-radius:8px' }),
    h('div', {}, h('h3', {}, p.title), h('div', { class: 'sub' }, `${p.destination || '—'} · ${p.duration || '—'} · ${fmtPrice(p.price, p.currency)}`),
      h('div', { class: 'chips' }, h('span', { class: 'chip ' + st[1] }, st[0]), h('span', { class: 'chip offer' }, p.category || 'Sin tipo'))),
    h('div', { class: 'acts' },
      h('button', { class: 'sm edit', onclick: () => openForm(p) }, 'Editar'),
      h('button', { class: p.status === 'paused' ? 'sm ok' : 'sm hide', onclick: () => setStatus(p, p.status === 'paused' ? 'active' : 'paused') }, p.status === 'paused' ? 'Reactivar' : 'Guardar sin mostrar'),
      h('button', { class: p.status === 'soldout' ? 'sm ok' : 'sm sold', onclick: () => setStatus(p, p.status === 'soldout' ? 'active' : 'soldout') }, p.status === 'soldout' ? 'Hay cupo' : 'Marcar agotado'),
      h('button', { class: 'sm danger', onclick: () => del(p) }, 'Eliminar')));
}

function setStatus(p, status) {
  if (status !== 'paused' && p.status === 'paused' && full(p.category, p.id)) return toast(catMsg(p.category), 'err');
  patch(p.id, { status }, { active: 'Paquete disponible', paused: 'Paquete guardado (ya no se muestra en el sitio)', soldout: 'Marcado como agotado' }[status]);
}

async function del(p) {
  if (!confirm(`¿Eliminar "${p.title}" definitivamente?\n\nSi solo querés que no se vea, usá "Pausar".`)) return;
  try { await store.deletePackage(p.id); packages = packages.filter(x => x.id !== p.id); renderPanel(); toast('Paquete eliminado'); }
  catch (e) { toast('No se pudo eliminar: ' + e.message, 'err'); }
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
    category: h('select', { required: true }, [h('option', { value: '' }, 'Elegí un tipo…'), ...CONFIG.categories.map(c => h('option', { value: c, selected: p.category === c }, c))]),
    status: h('select', {}, [['active', 'Disponible'], ['paused', 'Guardado (no se muestra en el sitio)'], ['soldout', 'Agotado']].map(([v, l]) => h('option', { value: v, selected: p.status === v }, l)))
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
    const status = f.status.value;
    if (!f.category.value) return toast('Elegí el tipo de viaje (Argentina, Brasil, Caribe u Otros)', 'err');
    if (status !== 'paused' && full(f.category.value, p.id)) return toast(catMsg(f.category.value), 'err');
    const out = { ...p, title: f.title.value.trim(), destination: f.destination.value.trim(), duration: f.duration.value.trim(),
      price: f.price.value === '' ? null : Number(f.price.value), oldPrice: f.oldPrice.value === '' ? null : Number(f.oldPrice.value),
      currency: f.currency.value, priceNote: f.priceNote.value.trim(), dates: lines(f.dates.value), description: f.description.value.trim(),
      includes: lines(f.includes.value), category: f.category.value, status, offer: false, offerOrder: 0 };
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
    fld('Estado', f.status, `"Disponible" y "Agotado" se muestran en el sitio (hasta ${MAX} por tipo). "Guardado" lo deja solo en el panel, sin mostrarlo.`),
    h('div', { class: 'two' }, fld('Precio', f.price), fld('Moneda', f.currency)),
    h('div', { class: 'two' }, fld('Precio anterior (opcional)', f.oldPrice, 'Se muestra tachado'), fld('Aclaración del precio', f.priceNote)),
    fld('Fechas de salida', f.dates, 'Una por línea'),
    fld('Descripción', f.description),
    fld('Qué incluye', f.includes, 'Un ítem por línea'),
    h('div', { class: 'fld' }, h('label', {}, `Fotos (hasta 5, la primera es la principal)`), file, photoBox),
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
  const docCard = n => {
    const cur = () => safeImg(s['q15Img' + n]) || s['q15ImgUrl' + n] || '';
    const prev = h('img', { alt: '', referrerpolicy: 'no-referrer', class: 'doc-prev', hidden: !cur(), src: cur() || undefined });
    const file = h('input', { type: 'file', accept: 'image/*', onchange: async e => {
      const x = e.target.files[0]; if (!x) return;
      try { const [d] = await fit([await toDataUrl(x, 800, .7)], 150000); s['q15Img' + n] = d; prev.src = d; prev.hidden = false; } catch (ex) { toast(ex.message, 'err'); }
    } });
    const link = h('input', { type: 'url', value: s['q15ImgUrl' + n] || '', placeholder: 'https://... (opcional, en vez de subir un archivo)' });
    link.addEventListener('input', () => { s['q15ImgUrl' + n] = link.value.trim(); if (/^https:\/\//i.test(link.value.trim())) { prev.src = link.value.trim(); prev.hidden = false; } });
    const clear = h('button', { class: 'sm', type: 'button', onclick: () => { delete s['q15Img' + n]; s['q15ImgUrl' + n] = ''; link.value = ''; file.value = ''; prev.hidden = true; } }, 'Quitar foto');
    const name = h('input', { value: s['q15Label' + n] || '', maxlength: 40, placeholder: n === 1 ? 'Ej: Bariloche 2027' : '' });
    name.addEventListener('input', () => { s['q15Label' + n] = name.value; });
    const url = h('input', { type: 'text', value: s['q15Url' + n] || '', placeholder: 'https://drive.google.com/...' });
    url.addEventListener('input', () => { s['q15Url' + n] = url.value.trim(); });
    return h('fieldset', { class: 'doc-card' },
      h('legend', {}, `Tarjeta ${n}`),
      h('div', { class: 'doc-grid' },
        h('div', { class: 'doc-photo' }, prev, h('div', { class: 'doc-photo-ctl' }, h('label', {}, 'Foto'), file, link, clear)),
        h('div', { class: 'doc-data' },
          h('div', { class: 'fld' }, h('label', {}, 'Nombre del botón'), name),
          h('div', { class: 'fld' }, h('label', {}, 'Link del PDF'), url, n === 1 ? h('small', {}, 'Subí el PDF a Google Drive → Compartir → "Cualquier persona con el enlace" → Copiar enlace. Si dejás los links vacíos, el banner no se muestra.') : null))));
  };
  return h('form', { style: 'display:grid;gap:14px;max-width:640px', onsubmit: async e => {
    e.preventDefault();
    if (!/^\d{10,15}$/.test(String(s.whatsapp).replace(/\D/g, ''))) return toast('Revisá el número de WhatsApp (con código de país, ej: 5491112345678)', 'err');
    if (s.armaUrl && !/^https?:\/\//i.test(s.armaUrl)) return toast('El link de "Armá tu viaje" debe empezar con https://', 'err');
    for (const n of [1, 2, 3, 4]) if (s['q15Url' + n] && !/^(https:\/\/|docs\/)/i.test(s['q15Url' + n])) return toast(`El link del documento ${n} tiene que empezar con https:// (o con docs/ si el archivo está dentro del sitio)`, 'err');
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
    ...[1, 2, 3, 4].map(docCard),
    h('div', { class: 'fld' }, h('label', {}, 'Banner de quince: al tocar una tarjeta'),
      h('select', { onchange: e => { s.q15Mode = e.target.value; } }, [['ver', 'Abrir el PDF para verlo (recomendado)'], ['descargar', 'Descargar el PDF directamente']].map(([v, l]) => h('option', { value: v, selected: (s.q15Mode || 'ver') === v }, l)))),
    mk('email', 'Email de contacto (opcional)', { type: 'email' }),
    mk('city', 'Ciudad / zona (opcional)'),
    h('div', { class: 'fld' }, h('label', {}, 'Foto principal de inicio (opcional)'), heroFile, heroPrev),
    h('div', { class: 'fld' }, h('label', {}, 'Foto de la titular, sección Nosotros (opcional)'), aboutFile, aboutPrev),
    h('button', { class: 'btn btn-clay', type: 'submit', style: 'justify-self:start' }, 'Guardar ajustes'),
    isDemo ? h('button', { class: 'sm', type: 'button', onclick: async () => { if (confirm('¿Volver a los datos de ejemplo?')) { await store.resetDemo(); showPanel(); } } }, 'Reiniciar datos de ejemplo (demo)') : null);
}

/* ---------- arranque ---------- */
store.onAuth(user => { if (user) showPanel(); else showLogin(); });
