// Utilidades de DOM seguras: nunca se usa innerHTML con datos cargados por el panel.
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function fmtPrice(n, cur = 'ARS') {
  if (n == null || n === '' || isNaN(n)) return 'Consultar';
  const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);
  return cur === 'USD' ? `USD ${num}` : `$ ${num}`;
}

export function waLink(number, text) {
  return `https://wa.me/${String(number || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

// Solo se aceptan imágenes embebidas del propio panel
export function safeImg(src) {
  return typeof src === 'string' && /^data:image\/(jpeg|png|webp|svg\+xml)[;,]/.test(src) ? src : '';
}

export function toast(msg, kind = '') {
  let box = $('#toasts');
  if (!box) { box = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
  const t = h('div', { class: 'toast ' + kind }, msg);
  box.append(t);
  setTimeout(() => t.remove(), 4200);
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
