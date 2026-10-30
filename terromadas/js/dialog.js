// Ventanas modales propias (reemplazan confirm/alert): confirmaciones y avisos del panel y del ingreso oculto.
import { h } from './dom.js';

const ICONS = {
  ok: 'M5 12.5l4.5 4.5L19 7.5',
  err: 'M12 7v6M12 17h.01',
  ask: 'M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 17h.01',
  key: 'M14 10a4 4 0 1 0-3.9 4H12l1.5 1.5H15V17h1.5v-1.5L19 13V10z'
};

function open({ kind = 'ask', title, message, buttons, auto = 0 }) {
  return new Promise(resolve => {
    const prevFocus = document.activeElement;
    const overlay = h('div', { class: 'dlg', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title });
    let done = false;
    const finish = v => {
      if (done) return; done = true;
      overlay.classList.add('out');
      document.removeEventListener('keydown', onKey, true);
      setTimeout(() => { overlay.remove(); if (!document.querySelector('.dlg') && !document.querySelector('.modal.open')) document.body.style.overflow = ''; prevFocus && prevFocus.focus && prevFocus.focus(); }, 160);
      resolve(v);
    };
    const onKey = e => {
      if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
      if (e.key === 'Enter' && document.activeElement && document.activeElement.tagName !== 'BUTTON') { e.preventDefault(); const p = overlay.querySelector('.primary'); p && p.click(); }
    };
    document.addEventListener('keydown', onKey, true);
    const btns = buttons.map(b => h('button', { type: 'button', class: 'dbtn ' + (b.cls || ''), onclick: () => finish(b.value) }, b.label));
    const icon = h('div', { class: 'dico ' + kind });
    // markup estático propio (sin datos externos)
    icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[kind] || ICONS.ask}"/></svg>`;
    overlay.append(h('div', { class: 'dbox' }, icon, h('h3', {}, title), message ? h('p', {}, message) : null, h('div', { class: 'dact' }, btns)));
    overlay.addEventListener('click', e => { if (e.target === overlay) finish(false); });
    document.body.append(overlay); document.body.style.overflow = 'hidden';
    const first = overlay.querySelector('.primary') || overlay.querySelector('button'); first && first.focus();
    if (auto) setTimeout(() => finish(true), auto);
  });
}

// ¿Seguro? → true / false
export const confirmDlg = ({ title, message, yes = 'Confirmar', no = 'Cancelar', danger = false, kind = 'ask' }) =>
  open({ kind, title, message, buttons: [{ label: no, value: false, cls: 'ghost' }, { label: yes, value: true, cls: 'primary' + (danger ? ' danger' : '') }] });

// Aviso de que algo salió bien (se cierra solo) o mal (espera el "Entendido")
export const successDlg = (title, message) => open({ kind: 'ok', title, message, auto: 1900, buttons: [{ label: 'Listo', value: true, cls: 'primary' }] });
export const errorDlg = (title, message) => open({ kind: 'err', title, message, buttons: [{ label: 'Entendido', value: true, cls: 'primary' }] });
