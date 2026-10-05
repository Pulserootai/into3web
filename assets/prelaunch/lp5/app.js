import { OFFER, remaining } from './offer.js';

const scripts = {
  sports: {title: 'Ek over ki 6 balls. 3 dot balls.', body: '6 mein se 3 balls par run nahi bana. Yaani aadha over dot balls tha.', equation: '3/6 = 1/2', key: 'Highlighted: 3 dot balls', alt: 'Six balls, with three dot balls highlighted'},
  bollywood: {title: 'Film ke 6 barabar parts. 3 dekh liye.', body: '6 barabar duration wale parts mein se 3 dekhe. Yaani aadhi film poori.', equation: '3/6 = 1/2', key: 'Highlighted: film ke 3 parts dekhe', alt: 'Six equal movie segments, with three watched segments highlighted'},
  comedy: {title: '“Bas ek aur!” Aur 3 biscuits gayab.', body: '6 mein se 3 biscuits kha liye. “Bas ek” ke chakkar mein aadha packet saaf!', equation: '3/6 = 1/2', key: 'Highlighted: 3 biscuits khaaye', alt: 'Six biscuit units, with three eaten units highlighted'},
  general: {title: '6 barabar hisse. 3 mein rang bhara.', body: '6 mein se 3 hisse colour kiye. Yaani shape ka aadha hissa colour hua.', equation: '3/6 = 1/2', key: 'Highlighted: 3 coloured parts', alt: 'Six equal parts, with three coloured parts highlighted'}
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
  panel.dataset.currentStyle = tab.dataset.style;
  panel.querySelector('[data-style-key]').textContent = item.key;
  panel.querySelector('.six-part-diagram').setAttribute('aria-label', item.alt);
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
