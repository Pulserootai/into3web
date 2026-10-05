import { OFFER, remaining } from './offer.js';

const scripts = {
  sports: { title:'6 balls. 3 dot balls.', body:'Ek over ki 6 balls mein 3 dot balls. Yaani 3/6 balls par run nahi bana — aadha over.', equation:'3/6 = 1/2' },
  bollywood: { title:'Interval tak aadhi kahaani.', body:'Ek film mein 6 barabar-length scenes hain. Interval se pehle 3 dekh liye. Yaani 3/6 scenes — aadhi film.', equation:'3/6 = 1/2' },
  comedy: { title:'Biscuit ka aadha packet gayab!', body:'Packet mein 6 biscuits the. “Bas ek aur” kehte-kehte 3 kha liye. Yaani 3/6 biscuits — aadha packet!', equation:'3/6 = 1/2' },
  general: { title:'6 equal parts. 3 selected.', body:'Kisi cheez ke 6 barabar hisse karo. Unmein se 3 hisse, poore ke aadhe ke barabar hain.', equation:'3/6 = 1/2' },
};
const tabs = [...document.querySelectorAll('[data-style]')];
function selectStyle(tab, moveFocus = false) {
  const item = scripts[tab.dataset.style];
  for (const other of tabs) {
    other.setAttribute('aria-selected', String(other === tab));
    other.tabIndex = other === tab ? 0 : -1;
  }
  const panel = document.querySelector('#style-example');
  panel.setAttribute('aria-labelledby', tab.id);
  panel.querySelector('.style-title').textContent = item.title;
  panel.querySelector('.style-body').textContent = item.body;
  panel.querySelector('.style-equation').textContent = item.equation;
  if (moveFocus) tab.focus();
}
for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => selectStyle(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); selectStyle(tabs[next], true); }
  });
}

let ended = false;
function renderCountdown() {
  const value = remaining(OFFER.deadline);
  if (!value) { document.querySelector('[data-countdown]').hidden = true; return; }
  for (const part of ['days','hours','minutes','seconds']) document.querySelector(`[data-time="${part}"]`).textContent = String(value[part]).padStart(2,'0');
  if (value.expired && !ended) {
    ended = true;
    document.querySelector('[data-countdown-title]').textContent = 'This founding-family offer has closed';
    document.querySelector('[data-offer-status]').textContent = 'The reservation window ended on 2 November 2026 at 10:31 pm IST.';
    document.querySelector('.secure-note').textContent = 'Contact the Into3 team for current availability.';
    for (const link of document.querySelectorAll('a[href="#reserve"], [data-booking-link]')) {
      link.textContent = 'Founding offer closed';
      link.setAttribute('aria-disabled','true');
      link.removeAttribute('href');
      link.removeAttribute('target');
    }
  }
}
renderCountdown();
setInterval(renderCountdown,1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderCountdown(); });
document.addEventListener('click', event => { if (event.target.closest('[aria-disabled="true"]')) event.preventDefault(); });
