// Animaciones: aparición al scroll (con distintas direcciones), parallax de capas, inclinación 3D de tarjetas,
// ondas en botones y barra de progreso. Si la persona pidió "reducir movimiento", no se anima nada.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
let io;

// Muestra los elementos .reveal cuando entran en pantalla (con un pequeño escalonado)
export function reveal(root = document) {
  const els = [...root.querySelectorAll('.reveal:not(.in)')];
  if (reduce || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  io = io || new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  els.forEach((e, i) => { if (!e.style.getPropertyValue('--d')) e.style.setProperty('--d', Math.min(i, 7) * 70 + 'ms'); io.observe(e); });
}

// [selector, efecto]: up (sube), left / right (entra de costado), zoom (crece)
const STATIC = [
  ['.sh > div:first-child', 'fx-left'], ['.sh > p', 'fx-right'], ['.fchips', 'fx-up'],
  ['.trust .it', 'fx-zoom'], ['.q15', 'fx-zoom'], ['.arma', 'fx-zoom'],
  ['.nos-photo', 'fx-left'], ['.nos > div:last-child', 'fx-right'], ['.nos-name', 'fx-zoom'],
  ['.cbox', 'fx-up'], ['.dhero .wrap > *', 'fx-up'], ['footer .wrap > div', 'fx-up']
];

// Formas de color difusas detrás de cada sección: dan profundidad y se mueven a otra velocidad al hacer scroll
const BLOBS = [
  ['#vidriera', [['gold', '-120px', null, '-60px', null, 380, .16], ['red', null, '-140px', null, '10%', 320, -.1]]],
  ['.arma', null],
  ['#nosotros', [['teal', null, '-120px', '8%', null, 340, .14], ['gold', '-100px', null, null, '6%', 300, -.12]]],
  ['#consulta', [['red', '-100px', null, '12%', null, 300, .12], ['gold', null, '-90px', null, '8%', 340, -.14]]],
  ['.dhero + section', [['gold', null, '-120px', '20%', null, 360, .15], ['teal', '-120px', null, null, '10%', 320, -.1]]]
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
  const els = [...document.querySelectorAll('[data-speed]')];
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

// Inclinación 3D y brillo que sigue al mouse en las tarjetas (solo con mouse, no en el celular)
function tilt() {
  if (!fine) return;
  addEventListener('pointermove', e => {
    const c = e.target.closest && e.target.closest('.pcard');
    if (!c) return;
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    c.style.setProperty('--rx', ((0.5 - y) * 7).toFixed(2) + 'deg');
    c.style.setProperty('--ry', ((x - 0.5) * 9).toFixed(2) + 'deg');
    c.style.setProperty('--mx', (x * 100).toFixed(0) + '%');
    c.style.setProperty('--my', (y * 100).toFixed(0) + '%');
  }, { passive: true });
  addEventListener('pointerout', e => {
    const c = e.target.closest && e.target.closest('.pcard');
    if (c && !c.contains(e.relatedTarget)) ['--rx', '--ry', '--mx', '--my'].forEach(k => c.style.removeProperty(k));
  });
}

// Onda al tocar un botón
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

export function initAnim() {
  if (reduce) return;
  document.documentElement.classList.add('anim');
  STATIC.forEach(([sel, fx]) => document.querySelectorAll(sel).forEach((e, i) => { e.classList.add('reveal', fx); e.style.setProperty('--d', Math.min(i, 5) * 80 + 'ms'); }));
  addBlobs();
  reveal();
  parallax();
  tilt();
  ripples();
  const nav = document.querySelector('.nav');
  const bar = document.createElement('div');
  bar.id = 'progress'; bar.setAttribute('aria-hidden', 'true');
  document.body.append(bar);
  const onScroll = () => {
    if (nav) nav.classList.toggle('scrolled', scrollY > 8);
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty('--p', max > 0 ? Math.min(1, scrollY / max).toFixed(3) : 0);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
}
