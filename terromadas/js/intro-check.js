// Pantalla de entrada: se muestra una vez por visita (por pestaña). Con ?intro=1 se fuerza para probarla.
try {
  const k = 'terromadas-intro';
  if (!/[?&]intro=1/.test(location.search) && sessionStorage.getItem(k)) document.documentElement.classList.add('no-intro');
  else sessionStorage.setItem(k, '1');
} catch (e) { /* sin almacenamiento: se muestra siempre */ }
