import { CONFIG } from './config.js';
import { initAnim, reveal } from './anim.js';
import { h, $ } from './dom.js';
import { visible, card, destinoUrl, openModal, loadCatalog, initChrome, applyCommon, mountContactForm } from './catalog.js';

async function init() {
  initChrome();
  initAnim();
  const tipo = new URLSearchParams(location.search).get('tipo');
  await loadCatalog();
  applyCommon();
  const ok = CONFIG.categories.includes(tipo);
  const list = ok ? visible(tipo) : [];
  document.title = ok ? `${tipo} | Terromadas Viajes` : 'Destinos | Terromadas Viajes';
  $('#dTitle').textContent = ok ? tipo : 'Nuestros destinos';
  $('#dCount').textContent = ok ? (list.length ? `${list.length} ${list.length === 1 ? 'propuesta' : 'propuestas'} para vos` : '') : 'Elegí un destino para ver todas sus propuestas.';
  const others = CONFIG.categories.filter(c => c !== tipo && visible(c).length);
  $('#dOthers').replaceChildren(...others.map(c => h('a', { class: 'fchip', href: destinoUrl(c) }, c)));
  const box = $('#dCards'); box.replaceChildren();
  if (list.length) list.forEach(p => box.append(card(p)));
  else if (ok) box.append(h('div', { class: 'empty', style: 'grid-column:1/-1' }, 'Por ahora no hay paquetes en este destino. Consultanos por WhatsApp y te armamos una propuesta.'));
  reveal(box);
  mountContactForm($('#contactForm'), ok ? tipo : '');
  const m = location.hash.match(/^#paquete=(.+)$/);
  if (m) openModal(decodeURIComponent(m[1]));
}
init();
