import { CONFIG } from './config.js';
import { h, $, waLink, safeImg } from './dom.js';
import { initAnim, reveal } from './anim.js';
import { state, trip, waNumber, fmtDate, visible, featured, FEATURED, card, destinoUrl, openModal, loadCatalog, initChrome, applyCommon, mountContactForm } from './catalog.js';

let sel = '';

/* ---------- "¿A dónde te gustaría viajar?": Destacados (8) y un filtro por destino (4 + "Ver más") ---------- */
function renderDestinos() {
  const feat = featured();
  const tabs = [...(feat.length ? [FEATURED] : []), ...CONFIG.categories.filter(c => visible(c).length)];
  if (!tabs.includes(sel)) sel = tabs[0] || '';
  $('#vidFilters').replaceChildren(...tabs.map(c =>
    h('button', { class: 'fchip', type: 'button', 'aria-pressed': sel === c, onclick: () => { sel = c; renderDestinos(); } }, c)));
  const vc = $('#vidCards'); vc.replaceChildren();
  const more = $('#vidMore'); more.replaceChildren();
  if (!sel) { vc.append(h('div', { class: 'empty', style: 'grid-column:1/-1' }, 'Estamos actualizando nuestros paquetes. Escribinos por WhatsApp y te asesoramos.')); return; }
  if (sel === FEATURED) { feat.forEach(p => vc.append(card(p, true))); reveal(vc); return; }
  const all = visible(sel);
  all.slice(0, 4).forEach(p => vc.append(card(p)));
  reveal(vc);
  more.append(h('a', { class: 'btn btn-red', href: destinoUrl(sel) }, `Ver más de ${sel}${all.length > 4 ? ` (${all.length})` : ''}`));
}

function applySettings() {
  const s = state.settings;
  $('#heroTitle').textContent = s.heroTitle;
  $('#heroTitle2').textContent = s.heroTitle2;
  $('#heroScript').textContent = s.heroScript;
  $('#heroText').textContent = s.heroText;
  const at = $('#aboutText'); at.replaceChildren(...String(s.about || '').split(/\n\s*\n/).filter(Boolean).map(t => h('p', {}, t.trim())));
  $('#ownerName').textContent = s.owner || '';
  $('#ownerRole').textContent = s.ownerRole || '';
  const ai = safeImg(s.aboutImage);
  if (ai) { const im = $('#aboutImg'); im.src = ai; im.hidden = false; $('#aboutArt').hidden = true; }
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
}

// Fotos del inicio que pasan solas (están en img/hero; si una no existe, se salta).
// La primera se muestra apenas carga; las demás se suman en orden y empiezan a rotar.
let heroStarted = false;
async function initHero() {
  if (heroStarted) return; heroStarted = true;
  const box = $('#heroSlides');
  const slides = [];
  let cur = 0;
  const load = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  const first = async base => { for (const ext of (/\.\w{3,4}$/.test(base) ? [''] : ['.jpg', '.jpeg', '.webp', '.png'])) { const im = await load(base + ext); if (im) return im; } return null; };
  const next = () => {
    if (document.hidden || slides.length < 2) return;
    slides[cur].classList.remove('on');
    cur = (cur + 1) % slides.length;
    slides[cur].classList.add('on');
  };
  for (const base of CONFIG.heroSlides) {
    const im = await first(base);
    if (!im) continue;
    im.alt = ''; box.append(im); slides.push(im);
    if (slides.length === 1) { im.classList.add('on'); $('#inicio').classList.add('has-img'); }
    if (slides.length === 2) setInterval(next, CONFIG.heroInterval);
  }
}

async function init() {
  initChrome();
  initAnim();

  // Cotización rápida: arma el mensaje de WhatsApp con destino, fecha y pasajeros
  $('#sDate').addEventListener('change', e => { trip.date = e.target.value; renderDestinos(); });
  $('#sPax').addEventListener('change', e => { trip.pax = e.target.value; renderDestinos(); });
  $('#search').addEventListener('submit', e => e.preventDefault());
  $('#sGo').addEventListener('click', () => {
    const dest = $('#sDest').value.trim();
    let t = dest ? `Hola Terromadas! Quiero cotizar un viaje a ${dest}` : 'Hola Terromadas! Quiero cotizar un viaje';
    if (trip.date) t += `. Fecha deseada: ${fmtDate(trip.date)}`;
    t += `. Pasajeros: ${trip.pax}.`;
    window.open(waLink(waNumber(), t), '_blank', 'noopener');
  });

  initHero(); // las fotos de la portada empiezan a bajar ya, en paralelo con los datos
  await loadCatalog();
  applySettings();
  applyCommon();
  renderDestinos();
  initHero();
  mountContactForm($('#contactForm'));
  const m = location.hash.match(/^#paquete=(.+)$/);
  if (m) openModal(decodeURIComponent(m[1]));
}
init();
