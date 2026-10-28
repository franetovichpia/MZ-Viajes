// Animaciones de la página (de "Paquetes" hacia abajo): títulos que suben palabra por palabra, ruta de avión que se dibuja
// con el scroll, cintas en movimiento, tarjetas 3D con vidrio, precios que cuentan, botones magnéticos, parallax y más.
// Si la persona pidió "reducir movimiento" en su dispositivo, se usa una versión suave (solo aparecer).
// Para probar todo igual: agregá ?anim=full al final de la dirección.
import { CONFIG } from './config.js';

const forced = /[?&]anim=full/.test(location.search);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches && !forced;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
let io;

/* ---------- aparecer al hacer scroll ---------- */
function countUp(card) {
  if (reduce) return;
  const b = card.querySelector('.price b');
  if (!b || b.dataset.done) return;
  b.dataset.done = '1';
  const m = /^(\D*?)([\d.]+)(\D*)$/.exec(b.textContent.trim());
  if (!m) return;
  const target = parseInt(m[2].replace(/\./g, ''), 10);
  if (!target) return;
  const fmt = n => new Intl.NumberFormat('es-AR').format(Math.round(n));
  const delay = parseFloat(card.style.getPropertyValue('--d')) || 0;
  b.textContent = m[1] + '0' + m[3];
  setTimeout(() => {
    const t0 = performance.now(), dur = 1200;
    const step = t => { const k = Math.min(1, (t - t0) / dur); b.textContent = m[1] + fmt(target * (1 - Math.pow(1 - k, 3))) + m[3]; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, delay + 250);
}

export function reveal(root = document) {
  const els = $$('.reveal:not(.in)', root);
  if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  io = io || new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('in');
    io.unobserve(en.target);
    if (en.target.classList.contains('pcard')) countUp(en.target);
  }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  els.forEach((e, i) => { if (!e.style.getPropertyValue('--d')) e.style.setProperty('--d', Math.min(i, 7) * 90 + 'ms'); io.observe(e); });
}

// [selector, efecto]: up (sube), left / right (entra de costado), zoom (crece)
const STATIC = [
  ['.sh > p', 'fx-right'], ['.sh .eyebrow', 'fx-up'], ['.fchips', 'fx-up'], ['.trust .it', 'fx-zoom'], ['.q15', 'fx-zoom'], ['.arma', 'fx-zoom'],
  ['.nos-photo', 'fx-left'], ['.nos > div:last-child > :not(h2)', 'fx-up'], ['.nos-name', 'fx-zoom'],
  ['.cbox > div:first-child > :not(h2)', 'fx-up'], ['.cbox .cform', 'fx-up'], ['.dhero .wrap > *', 'fx-up'], ['footer .wrap > div', 'fx-up']
];

// Los títulos se parten en palabras que suben una por una
function splitTitles() {
  $$('.sh h2, .cbox h2, .arma h2, .nos h2').forEach(h2 => {
    let i = 0;
    const wrap = node => {
      const w = document.createElement('span'), s = document.createElement('span');
      w.className = 'w'; s.style.setProperty('--i', i++); s.append(node); w.append(s);
      return w;
    };
    const out = [];
    [...h2.childNodes].forEach(n => {
      if (n.nodeType === 3) n.textContent.split(/(\s+)/).forEach(tok => { if (tok) out.push(/^\s+$/.test(tok) ? document.createTextNode(' ') : wrap(document.createTextNode(tok))); });
      else out.push(wrap(n));
    });
    h2.replaceChildren(...out);
    h2.classList.add('split', 'reveal', 'fx-split');
  });
}

/* ---------- capas de fondo con parallax ---------- */
const BLOBS = [
  ['#vidriera', [['gold', '-120px', null, '-60px', null, 420, .16], ['red', null, '-140px', null, '10%', 360, -.1]]],
  ['.arma', null],
  ['#nosotros', [['teal', null, '-120px', '8%', null, 380, .14], ['gold', '-100px', null, null, '6%', 340, -.12]]],
  ['#consulta', [['red', '-100px', null, '12%', null, 340, .12], ['gold', null, '-90px', null, '8%', 380, -.14]]],
  ['.dhero + section', [['gold', null, '-120px', '20%', null, 400, .15], ['teal', '-120px', null, null, '10%', 360, -.1]]]
];

function addBlobs() {
  for (const [sel, list] of BLOBS) {
    const host = document.querySelector(sel);
    if (!host) continue;
    const sec = host.matches('section') ? host : host.closest('section');
    if (!sec) continue;
    sec.classList.add('has-blobs');
    if (sel === '.arma') { const mark = host.querySelector('.mark'); if (mark) mark.dataset.speed = '-0.07'; continue; }
    list.forEach(([color, left, right, top, bottom, size, speed]) => {
      const b = document.createElement('span');
      b.className = 'blob ' + color; b.setAttribute('aria-hidden', 'true');
      b.dataset.speed = String(speed);
      Object.assign(b.style, { width: size + 'px', height: size + 'px' });
      if (left) b.style.left = left; if (right) b.style.right = right; if (top) b.style.top = top; if (bottom) b.style.bottom = bottom;
      sec.prepend(b);
    });
  }
}

function parallax() {
  const els = $$('[data-speed]');
  if (!els.length) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const vh = innerHeight;
    for (const el of els) {
      const r = (el.closest('section') || el.parentElement).getBoundingClientRect();
      if (r.bottom < -300 || r.top > vh + 300) continue;
      el.style.setProperty('--py', ((r.top + r.height / 2 - vh / 2) * parseFloat(el.dataset.speed)).toFixed(1) + 'px');
    }
  };
  const ask = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', ask, { passive: true }); addEventListener('resize', ask); update();
}

/* ---------- ruta de avión que se dibuja mientras bajás ---------- */
function route() {
  const main = document.querySelector('main');
  const start = document.querySelector('.search') || document.querySelector('.dhero');
  if (!main || !start) return;
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, cls) => { const e = document.createElementNS(NS, tag); if (cls) e.setAttribute('class', cls); return e; };
  const svg = mk('svg'); svg.id = 'route'; svg.setAttribute('aria-hidden', 'true');
  const base = mk('path', 'base'), done = mk('path', 'done'), plane = mk('g', 'plane');
  const body = mk('path'); body.setAttribute('d', 'M0-26 8-10l26 12v8L8 4l-2 16 10 8v6L0 30-16 34v-6l10-8-2-16-26 6v-8l26-12z');
  plane.append(body); svg.append(base, done, plane); main.prepend(svg);
  let L = 1, top = 0, H = 1;
  const layout = () => {
    const W = main.clientWidth;
    top = start.offsetTop + start.offsetHeight;
    H = Math.max(400, main.scrollHeight - top - 60);
    const n = Math.max(2, Math.round(H / 760)), narrow = W < 700;
    const xs = [0.5 * W, ...Array.from({ length: n }, (_, k) => (k % 2 ? (narrow ? .9 : .93) : (narrow ? .1 : .07)) * W)];
    let d = `M${xs[0]} 0`;
    for (let k = 1; k < xs.length; k++) {
      const y0 = (k - 1) / n * H, y1 = k / n * H, dy = y1 - y0;
      d += ` C${xs[k - 1]} ${y0 + dy * .55} ${xs[k]} ${y1 - dy * .55} ${xs[k]} ${y1}`;
    }
    Object.assign(svg.style, { top: top + 'px', width: W + 'px', height: H + 'px' });
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    base.setAttribute('d', d); done.setAttribute('d', d);
    L = base.getTotalLength();
    done.style.strokeDasharray = L;
    update();
  };
  const update = () => {
    const p = Math.max(0, Math.min(1, (scrollY + innerHeight * 0.6 - top - main.offsetTop) / H));
    done.style.strokeDashoffset = L * (1 - p);
    const a = base.getPointAtLength(p * L), b = base.getPointAtLength(Math.min(L, p * L + 3));
    const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 90;
    plane.setAttribute('transform', `translate(${a.x} ${a.y}) rotate(${ang}) scale(.8)`);
    svg.classList.toggle('on', p > 0.005 && p < 0.995);
  };
  layout();
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(layout, 200); });
  addEventListener('load', () => setTimeout(layout, 300));
  addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
}

/* ---------- cintas en movimiento entre secciones ---------- */
function marquee() {
  const anchor = document.querySelector('#vidriera');
  if (!anchor) return;
  const words = [...CONFIG.categories, 'Armá tu viaje', 'Viajes de 15', 'Terromadas'];
  const band = (cls, rev) => {
    const row = document.createElement('div'); row.className = 'mq ' + cls;
    const track = document.createElement('div'); track.className = 'mq-track' + (rev ? ' rev' : '');
    for (let g = 0; g < 2; g++) {
      const grp = document.createElement('div'); grp.className = 'mq-grp';
      for (let r = 0; r < 2; r++) words.forEach(w => { const s = document.createElement('span'); s.textContent = w; const i = document.createElement('i'); i.textContent = '✦'; grp.append(s, i); });
      track.append(grp);
    }
    row.append(track); return row;
  };
  const wrap = document.createElement('div'); wrap.className = 'mq-wrap'; wrap.setAttribute('aria-hidden', 'true');
  wrap.append(band('mq-red', false), band('mq-gold', true));
  anchor.before(wrap);
}

/* ---------- interacción con el mouse ---------- */
function mouse() {
  if (!fine) return;
  // inclinación 3D + brillo en tarjetas
  addEventListener('pointermove', e => {
    const t = e.target.closest && e.target;
    if (!t) return;
    const c = t.closest('.pcard');
    if (c) {
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty('--rx', ((0.5 - y) * 10).toFixed(2) + 'deg');
      c.style.setProperty('--ry', ((x - 0.5) * 14).toFixed(2) + 'deg');
      c.style.setProperty('--mx', (x * 100).toFixed(0) + '%');
      c.style.setProperty('--my', (y * 100).toFixed(0) + '%');
    }
    // botones magnéticos (menos los de la portada)
    const b = t.closest('.btn');
    if (b && !b.closest('.hero')) {
      const r = b.getBoundingClientRect();
      b.style.setProperty('--tx', ((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1) + 'px');
      b.style.setProperty('--ty', ((e.clientY - r.top - r.height / 2) * 0.32).toFixed(1) + 'px');
    }
    // luz que sigue al mouse en la sección de paquetes
    const sec = t.closest('.has-spot');
    if (sec) { const r = sec.getBoundingClientRect(); sec.style.setProperty('--sx', (e.clientX - r.left) + 'px'); sec.style.setProperty('--sy', (e.clientY - r.top) + 'px'); }
  }, { passive: true });
  addEventListener('pointerout', e => {
    const t = e.target.closest && e.target;
    if (!t) return;
    const c = t.closest('.pcard');
    if (c && !c.contains(e.relatedTarget)) ['--rx', '--ry', '--mx', '--my'].forEach(k => c.style.removeProperty(k));
    const b = t.closest('.btn');
    if (b && !b.contains(e.relatedTarget)) { b.style.removeProperty('--tx'); b.style.removeProperty('--ty'); }
  });
  const v = document.querySelector('#vidriera');
  if (v) { v.classList.add('has-spot'); const s = document.createElement('span'); s.className = 'spot'; s.setAttribute('aria-hidden', 'true'); v.prepend(s); }
}

function ripples() {
  addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('.btn');
    if (!b) return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 1.6;
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    b.append(s);
    setTimeout(() => s.remove(), 650);
  });
}

// El botón flotante de WhatsApp no tapa el pie de página: se detiene arriba de él (o se esconde si el pie es muy alto)
function fabAboveFooter() {
  const fab = document.getElementById('fab'), foot = document.querySelector('footer');
  if (!fab || !foot) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const over = innerHeight - foot.getBoundingClientRect().top;
    const tall = foot.offsetHeight > innerHeight * 0.6;
    fab.classList.toggle('hide', tall && over > 40);
    fab.style.setProperty('--fab-lift', tall ? '0px' : Math.max(0, over) + 'px');
  };
  const ask = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', ask, { passive: true }); addEventListener('resize', ask); update();
}

export function initAnim() {
  const html = document.documentElement;
  html.classList.add('anim');
  fabAboveFooter();
  if (reduce) html.classList.add('soft');
  if (!reduce) splitTitles();
  STATIC.forEach(([sel, fx]) => $$(sel).forEach((e, i) => { e.classList.add('reveal', fx); e.style.setProperty('--d', Math.min(i, 5) * 90 + 'ms'); }));
  if (!reduce) { addBlobs(); marquee(); }
  reveal();
  if (!reduce) { parallax(); route(); mouse(); ripples(); }
  const nav = document.querySelector('.nav');
  const bar = document.createElement('div');
  bar.id = 'progress'; bar.setAttribute('aria-hidden', 'true');
  document.body.append(bar);
  const onScroll = () => {
    if (nav) nav.classList.toggle('scrolled', scrollY > 8);
    const max = html.scrollHeight - innerHeight;
    bar.style.setProperty('--p', max > 0 ? Math.min(1, scrollY / max).toFixed(3) : 0);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
}
