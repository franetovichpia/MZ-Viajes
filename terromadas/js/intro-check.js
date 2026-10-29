// Pantalla de entrada: se muestra una vez por visita (por pestaña). Con ?intro=1 se fuerza para probarla.
// El reloj de la animación arranca cuando el logo ya cargó y la pantalla ya se pintó (así en celulares lentos no se la pierden).
try {
  const k = 'terromadas-intro';
  if (!/[?&]intro=1/.test(location.search) && sessionStorage.getItem(k)) document.documentElement.classList.add('no-intro');
  else sessionStorage.setItem(k, '1');
} catch (e) { /* sin almacenamiento: se muestra siempre */ }

(function () {
  const root = document.documentElement;
  if (root.classList.contains('no-intro')) return;
  const go = () => {
    if (root.classList.contains('intro-run')) return;
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('intro-run')));
  };
  const ready = () => {
    const img = document.querySelector('.intro-logo');
    if (img && !img.complete) { img.addEventListener('load', go, { once: true }); img.addEventListener('error', go, { once: true }); }
    else go();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
  setTimeout(go, 3500); // por si el logo tarda demasiado
})();
