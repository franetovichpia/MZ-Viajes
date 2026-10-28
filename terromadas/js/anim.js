// Animaciones suaves: aparición al hacer scroll, tarjetas escalonadas y sombra del menú.
// Si la persona pidió "reducir movimiento" en su dispositivo, no se anima nada y todo se ve normal.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
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

const STATIC = ['.sh', '.fchips', '.trust .it', '.q15', '.arma', '.nos-photo', '.nos > div:last-child', '.nos-name', '.cbox', '.dhero .wrap > *'];

export function initAnim() {
  if (reduce) return;
  document.documentElement.classList.add('anim');
  STATIC.forEach(sel => document.querySelectorAll(sel).forEach((e, i) => { e.classList.add('reveal'); e.style.setProperty('--d', Math.min(i, 5) * 80 + 'ms'); }));
  reveal();
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }
}
