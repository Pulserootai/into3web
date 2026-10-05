import { OFFER, remaining } from './offer.js';

function bindTabs(selector, onSelect) {
  const tabs = [...document.querySelectorAll(selector)];
  function select(tab, focus = false) {
    for (const other of tabs) {
      other.setAttribute('aria-selected', String(tab === other));
      other.tabIndex = tab === other ? 0 : -1;
    }
    onSelect(tab);
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', event => {
      const positions = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 };
      if (Object.hasOwn(positions, event.key)) {
        event.preventDefault();
        select(tabs[positions[event.key]], true);
      }
    });
  });
}

bindTabs('[data-style]', tab => {
  for (const panel of document.querySelectorAll('.video-panel')) {
    const selected = panel.id === tab.getAttribute('aria-controls');
    if (!selected) panel.querySelector('video').pause();
    panel.hidden = !selected;
  }
});

for (const panel of document.querySelectorAll('.video-panel')) {
  const video = panel.querySelector('video');
  const playButton = panel.querySelector('.video-play');
  const error = panel.querySelector('.video-error');
  playButton.hidden = false;
  playButton.addEventListener('click', () => {
    error.hidden = true;
    video.play().catch(() => { error.hidden = false; });
  });
  video.addEventListener('play', () => {
    for (const other of document.querySelectorAll('.video-panel video')) {
      if (other !== video) other.pause();
    }
    playButton.hidden = true;
  });
  video.addEventListener('ended', () => { playButton.hidden = false; });
  const showError = () => { error.hidden = false; playButton.hidden = true; };
  video.addEventListener('error', showError);
  video.querySelector('source').addEventListener('error', showError);
}

let offerClosed = false;
function renderCountdown() {
  const value = remaining(OFFER.deadline);
  if (!value) return;
  for (const part of ['days','hours','minutes','seconds']) {
    document.querySelector(`[data-time="${part}"]`).textContent = String(value[part]).padStart(2,'0');
  }
  if (value.expired && !offerClosed) {
    offerClosed = true;
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
